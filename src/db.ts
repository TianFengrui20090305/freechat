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
