import { TurnstileResponse } from "./models";

export function validateId(id: string): {
  valid: boolean;
  msg: string;
} {
  const len = id?.trim().length || 0;
  if (len < 3 || len > 20) {
    return { valid: false, msg: "用户ID长度需在 3-20 位之间" };
  }
  return { valid: true, msg: "用户ID有效" };
}

export function validateUsername(username: string): {
  valid: boolean;
  msg: string;
} {
  const len = username?.trim().length || 0;
  if (len < 1 || len > 20) {
    return { valid: false, msg: "用户名长度需在 1-20 位之间" };
  }
  return { valid: true, msg: "" };
}

export function validatePasswordHash(clientHash: string): {
  valid: boolean;
  msg: string;
} {
  // 1. 基础存在性校验
  if (!clientHash) {
    return { valid: false, msg: "安全凭据不能为空" };
  }

  // 2. 严格长度校验
  // 如果前端统一使用 SHA-256，那么长度必须固定为 64
  // 如果为了兼容性（比如未来升级 SHA-512），可以放宽到 [64, 128]
  if (clientHash.length !== 64) {
    return { valid: false, msg: "非法请求：安全凭据格式错误" };
  }

  // 3. 严格字符集校验
  // 前端 Hash 出来的 Hex 字符串只会有数字和 a-f
  const hexRegex = /^[a-fA-F0-9]+$/;
  if (!hexRegex.test(clientHash)) {
    return { valid: false, msg: "非法请求：包含恶意字符" };
  }

  return { valid: true, msg: "安全凭据有效" };
}

export async function verifyTurnstile(
  token: string,
  secretKey: string,
  remoteIp?: string,
): Promise<boolean> {
  const formData = new URLSearchParams();
  formData.append("secret", secretKey);
  formData.append("response", token);
  formData.append("remoteip", remoteIp || "");

  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        body: formData,
        method: "POST",
      },
    );

    const data: TurnstileResponse = await response.json();
    return data.success === true;
  } catch (error) {
    console.error("Error verifying Turnstile token:", error);
    return false;
  }
}
