export const MessageValidator = {
  validate(msg: string, limit: number): { isValid: boolean; msg: string } {
    const trimmed = msg.trim();
    if (trimmed.length === 0) {
      return { isValid: false, msg: "消息内容不能为空" };
    }
    if (trimmed.length > limit) {
      return { isValid: false, msg: "消息内容不能超过最大长度限制" };
    }
    return { isValid: true, msg: "" };
  },
};
