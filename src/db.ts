import { type User, type PublicUser } from "./models";

async function hashPassword(
  user: { salt: string },
  clientHash: string,
): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const saltBuffer = encoder.encode(user.salt);
    const clientHashBuffer = encoder.encode(clientHash);

    const baseKey = await crypto.subtle.importKey(
      "raw",
      clientHashBuffer,
      { name: "PBKDF2" },
      false,
      ["deriveBits"],
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: saltBuffer,
        iterations: 50000,
        hash: "SHA-256",
      },
      baseKey,
      512,
    );

    const derivedHex = Array.from(new Uint8Array(derivedBits))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return derivedHex;
  } catch (error) {
    console.error("Error hashing password:", error);
    throw error;
  }
}

export async function verifyUser(
  db: D1Database,
  id: string,
  clientHash: string,
): Promise<boolean> {
  const user = await db
    .prepare("SELECT password, salt FROM users WHERE id = ?")
    .bind(id)
    .first<{ password: string; salt: string }>();

  // 如果用户不存在，直接返回 false
  if (!user) {
    return false;
  }

  // 验证密码
  try {
    const hashedPassword = await hashPassword(user, clientHash);
    return hashedPassword === user.password;
  } catch (error) {
    return false;
  }
}

export async function registerUser(
  db: D1Database,
  id: string,
  username: string,
  clientHash: string,
  invcode_id?: number,
): Promise<{ success: boolean; msg: string; content: {} }> {
  // 检查用户名是否已存在
  try {
    const { count } = (await db
      .prepare("SELECT COUNT(*) as count FROM users WHERE id = ?")
      .bind(id)
      .first<{ count: number }>()) || { count: 0 };

    if (count > 0) {
      return { success: false, msg: "用户ID已存在", content: {} };
    }
  } catch (error) {
    console.error("Error checking existing user:", error);
    return { success: false, msg: "注册失败", content: {} };
  }

  try {
    // 生成新的盐值
    const salt = crypto.randomUUID();

    // 计算哈希值
    const hashedPassword = await hashPassword({ salt }, clientHash);

    // 构造数据库写入请求
    let batchRequests = [
      db
        .prepare(
          "INSERT INTO users (id, username, password, salt, invcode_id, createdAt) VALUES (?, ?, ?, ?, ?, strftime('%s', 'now'))",
        )
        .bind(id, username, hashedPassword, salt, invcode_id ?? null),
    ];

    if (invcode_id !== undefined) {
      batchRequests.push(
        db
          .prepare(
            "UPDATE registration_codes SET is_used = 1, used_at = strftime('%s', 'now') WHERE id = ?",
          )
          .bind(invcode_id),
      );
    }

    // 更新数据库
    await db.batch(batchRequests);
  } catch (error) {
    console.error("Error registering user:", error);
    return { success: false, msg: "注册失败", content: {} };
  }

  return { success: true, msg: "注册成功", content: {} };
}

export async function getUserById(
  db: D1Database,
  id: string,
): Promise<User | null> {
  const user = await db
    .prepare(
      "SELECT id, username, avatar_id, bio, invcode_id, is_disabled, createdAt, updatedAt, deletedAt FROM users WHERE id = ?",
    )
    .bind(id)
    .first<User>();
  return user || null;
}

export async function getPublicUser(
  db: D1Database,
  id: string,
): Promise<PublicUser | null> {
  const user = await db
    .prepare(
      "SELECT id, username, avatar_id, bio, createdAt FROM users WHERE id = ?",
    )
    .bind(id)
    .first<PublicUser>();
  return user || null;
}

export async function updateUser(
  db: D1Database,
  id: string,
  data: { username?: string; bio?: string; avatar_id?: string },
): Promise<{ success: boolean; msg: string }> {
  const fields: string[] = [];
  const values: (string | number)[] = [];

  if (data.username !== undefined) {
    fields.push("username = ?");
    values.push(data.username);
  }
  if (data.bio !== undefined) {
    fields.push("bio = ?");
    values.push(data.bio);
  }
  if (data.avatar_id !== undefined) {
    fields.push("avatar_id = ?");
    values.push(data.avatar_id);
  }

  if (fields.length === 0) {
    return { success: false, msg: "没有需要更新的字段" };
  }

  fields.push("updatedAt = strftime('%s', 'now')");

  try {
    await db
      .prepare(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`)
      .bind(...values, id)
      .run();
    return { success: true, msg: "更新成功" };
  } catch (error) {
    console.error("Error updating user:", error);
    return { success: false, msg: "更新失败" };
  }
}

export async function getUserSettings(
  db: D1Database,
  userId: string,
): Promise<Record<string, string>> {
  const rows = await db
    .prepare(
      "SELECT setting_key, setting_value FROM user_settings WHERE user_id = ?",
    )
    .bind(userId)
    .all<{ setting_key: string; setting_value: string }>();

  const settings: Record<string, string> = {};
  for (const row of rows.results) {
    settings[row.setting_key] = row.setting_value;
  }
  return settings;
}

export async function upsertUserSetting(
  db: D1Database,
  userId: string,
  key: string,
  value: string,
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO user_settings (user_id, setting_key, setting_value) VALUES (?, ?, ?) ON CONFLICT(user_id, setting_key) DO UPDATE SET setting_value = ?",
    )
    .bind(userId, key, value, value)
    .run();
}

export async function getMyProfile(db: D1Database, userId: string) {
  const profile = await db
    .prepare(
      "SELECT id, username, avatar_id, bio, is_disabled, createdAt, updatedAt FROM users WHERE id = ?",
    )
    .bind(userId)
    .first<{
      id: string;
      username: string;
      avatar_id: string;
      bio: string;
      is_disabled: number;
      createdAt: number;
      updatedAt: number;
    }>();
  return profile;
}
