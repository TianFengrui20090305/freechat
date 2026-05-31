import { Hono } from "hono";
import { createToken, verifyInvcode, verifyToken } from "./auth";
import {
  verifyUser,
  registerUser,
  getUserById,
  getPublicUser,
  updateUser,
  getUserSettings,
  upsertUserSetting,
  getMyProfile,
} from "./db";
import {
  validateId,
  validateUsername,
  validatePasswordHash,
  validateBio,
  verifyTurnstile,
} from "./utils";
import { isValidSession } from "./session";

const app = new Hono<{
  Bindings: Env;
  Variables: { userId: string; username: string };
}>();

app.use("/api/*", async (c, next) => {
  const path = c.req.path;

  // 放行白名单
  const isAuthRoute =
    path === "/api/auth/login" ||
    path === "/api/auth/verify" ||
    (path === "/api/auth/register" && c.env.ALLOW_REG === "true") ||
    path === "/api/status";

  if (isAuthRoute) {
    await next();
    return;
  }

  const payload = await isValidSession(
    c.req.header("Authorization"),
    c.env.JWT_SIGNING_KEY,
  );
  if (!payload) {
    return c.json(
      { success: false, msg: "身份验证过期或无效，请重新登录" },
      401,
    );
  }
  c.set("userId", payload.userId);
  c.set("username", payload.username);
  await next();
});

app.get("/api/status", (c) => {
  return c.json({ msg: "Boot API Service Successfully" });
});

// 可恶的get暴露账密，增删改查没对上（恼
app.post("/api/auth/login", async (c) => {
  try {
    const { id, username, clientHash } = await c.req.json();
    if (await verifyUser(c.env.freechat_db, id, clientHash)) {
      // 处理登录成功逻辑
      const token = await createToken(
        { id: id, username: username },
        c.env.JWT_SIGNING_KEY,
      );
      return c.json({ success: true, msg: "登录成功", token: token });
    }
    return c.json({ success: false, msg: "用户名或密码错误" }, 401);
  } catch (error) {
    console.error("Error during login:", error);
    return c.json({ success: false, msg: "登录异常，请稍后再试" }, 500);
  }
});

app.post("/api/auth/register", async (c) => {
  // 注册是否开放
  if (c.env.ALLOW_REG !== "true") {
    return c.json({ success: false, msg: "注册功能已关闭" }, 400);
  }

  try {
    const { id, username, clientHash } = await c.req.json();

    // Captcha验证码
    const isValidCaptcha = await verifyTurnstile(
      c.req.header("cf-turnstile-response") || "",
      c.env.TURNSTILE_SECRET_KEY,
      c.req.header("CF-Connecting-IP") || undefined,
    );

    if (!isValidCaptcha) {
      return c.json({ success: false, msg: "验证码验证失败" }, 400);
    }

    // 检查邀请码
    let invcodeId: number | undefined;
    if (c.env.REG_INVCODE_REQUIRED === "true") {
      const invcode = c.req.header("X-Registration-Code") || "";
      const invcodeRes = await verifyInvcode(c.env.freechat_db, invcode);
      if (invcodeRes.status !== "available") {
        return c.json({ success: false, msg: invcodeRes.msg }, 400);
      }
      invcodeId = invcodeRes.content.id;
    }

    // 输入校验
    const validateResults = (() => {
      const results = [];
      results.push(validateId(id));
      results.push(validateUsername(username));
      results.push(validatePasswordHash(clientHash));
      return {
        valid: results.every((r) => r.valid),
        msg: results.map((r) => r.msg),
      };
    })();

    if (!validateResults.valid) {
      return c.json({ success: false, msg: validateResults.msg }, 400);
    }

    // 注册用户
    const regMsg = await registerUser(
      c.env.freechat_db,
      id,
      username,
      clientHash,
      invcodeId,
    );
    if (regMsg.success) {
      return c.json({ success: true, msg: regMsg.msg }, 201);
    }
    return c.json({ success: false, msg: regMsg.msg }, 400);
  } catch (error) {
    console.error("Error during registration:", error);
    const isJsonError = error instanceof SyntaxError && "message" in error;
    return c.json(
      {
        success: false,
        msg: isJsonError ? "请求数据格式错误" : "注册异常，请稍后再试",
      },
      isJsonError ? 400 : 500,
    );
  }
});

// app.post("/api/auth/verify", async (c) => {

// });

// app.all("/ws/:type/:id", async (c) => {
//   const { type, id } = c.req.param();
//   const channelId = `${type}_${id}`;
// });

app.get("/api/user/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const user = await getPublicUser(c.env.freechat_db, userId);
    if (!user) return c.json({ success: false, msg: "用户不存在" }, 404);
    return c.json({ success: true, content: user });
  } catch (error) {
    console.error("Error getting user:", error);
    return c.json({ success: false, msg: "获取用户信息失败" }, 500);
  }
});

app.get("/api/me", async (c) => {
  try {
    const userId = c.get("userId");
    const profile = await getMyProfile(c.env.freechat_db, userId);
    return c.json({ success: true, msg: "", content: profile }, 200);
  } catch {
    return c.json(
      { success: false, msg: "服务器内部错误", content: null },
      500,
    );
  }
});

app.patch("/api/me", async (c) => {
  try {
    const userId = c.get("userId");
    const body = await c.req.json();
    const { username, bio, avatar_id } = body;
    const result = await updateUser(c.env.freechat_db, userId, { username, bio, avatar_id });
    if (result.success) {
      return c.json({ success: true, msg: result.msg });
    }
    return c.json({ success: false, msg: result.msg }, 400);
  } catch (error) {
    console.error("Error updating user:", error);
    return c.json({ success: false, msg: "更新失败" }, 500);
  }
});

app.get("/api/me/settings", async (c) => {
  try {
    const userId = c.get("userId");
    const settings = await getUserSettings(c.env.freechat_db, userId);
    return c.json({ success: true, content: settings });
  } catch (error) {
    console.error("Error getting settings:", error);
    return c.json({ success: false, msg: "获取设置失败" }, 500);
  }
});

app.patch("/api/me/settings", async (c) => {
  try {
    const userId = c.get("userId");
    const body = await c.req.json();
    for (const [key, value] of Object.entries(body)) {
      await upsertUserSetting(c.env.freechat_db, userId, key, String(value));
    }
    return c.json({ success: true, msg: "设置已更新" });
  } catch (error) {
    console.error("Error updating settings:", error);
    return c.json({ success: false, msg: "更新设置失败" }, 500);
  }
});

app.get("/api/contact/:userId", async (c) => {});

app.patch("/api/contact/:userId", async (c) => {});

app.post("/api/file/upload", async (c) => {});

app.get("/api/file/:fileId", async (c) => {});

app.get("/api/admin/review", async (c) => {});

// WebSocket route — forward to Durable Object
// The auth middleware doesn't apply since it only matches /api/*
app.all("/ws/:channelId", async (c) => {
  try {
    const channelId = c.req.param("channelId");
    const doId = c.env.CHAT_ROOM.idFromName(channelId);
    const stub = c.env.CHAT_ROOM.get(doId);

    // Forward channelId to the DO via query param
    const url = new URL(c.req.url);
    url.searchParams.set("channelId", channelId);
    const req = new Request(url.toString(), c.req.raw);
    return stub.fetch(req);
  } catch (error) {
    console.error("Error in WebSocket route:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
});

export { ChatRoom } from "./do/channel";
export default app;
