import { sign, verify } from "hono/jwt";

export interface JWTPayload {
  userId: string;
  username: string;
  exp: number;
  [key: string]: unknown;
}

export const createToken = async (
  user: { id: string; username: string },
  secret: string,
) => {
  const payload: JWTPayload = {
    userId: user.id,
    username: user.username,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // Token expires in 1 day
  };
  return await sign(payload, secret, "HS256");
};

export const verifyToken = async (
  token: string,
  secret: string,
): Promise<JWTPayload | null> => {
  try {
    const payload = (await verify(token, secret, "HS256")) as JWTPayload;
    return payload;
  } catch {
    return null;
  }
};

export async function createInvcode(
  db: D1Database,
  note: string,
  created_by: string,
  count = 1,
): Promise<{ success: boolean; msg: string; content: {} }> {
  try {
    // 随机生成8位UUID填充registration_codes.code
    const codes: string[] = Array.from({ length: count }, () =>
      Math.random().toString(36).substring(2, 10),
    );

    // 构造数据库写入请求
    const stmt = db.prepare(
      "INSERT INTO registration_codes (code, note, created_by, created_at) VALUES (?, ?, ?, strftime('%s', 'now'))",
    );
    const batchRequests = codes.map((code) => {
      return stmt.bind(code, note, created_by);
    });

    // 写入数据库
    await db.batch(batchRequests);
    return { success: true, msg: "创建邀请码成功", content: { codes: codes } };
  } catch {
    return { success: false, msg: "内部服务器错误", content: {} };
  }
}

export async function verifyInvcode(
  db: D1Database,
  code: string,
): Promise<{ status: string; msg: string; content: { id?: number } }> {
  const codeRec = await db
    .prepare(
      "SELECT id, is_used, used_at FROM registration_codes WHERE code = ?",
    )
    .bind(code)
    .first<{ id: number; is_used: number; used_at: number }>();
  if (codeRec === null) {
    return { status: "invalid", msg: "邀请码无效", content: {} };
  }
  if (codeRec.is_used === 1) {
    return { status: "used", msg: "邀请码已使用", content: {} };
  }
  return { status: "available", msg: "", content: { id: codeRec.id } };
}
