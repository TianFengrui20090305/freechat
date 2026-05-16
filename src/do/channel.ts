import { BaseMessage } from "../models";
import { MessageValidator } from "../middleware";

export abstract class ChatInstance implements DurableObject {
  private state: DurableObjectState;
  private env: any;
  private mode: "pvt" | "room";
  private config: {
    prefix: string;
    table: string;
  };

  constructor(state: DurableObjectState, env: any) {
    const id = state.id.toString();

    this.state = state;
    this.env = env;
    this.mode = id.includes("pvt") ? "pvt" : "room";

    this.config = {
      prefix: this.mode === "pvt" ? "buf_pvt_" : "buf_room_",
      table: "messages",
      // table: this.mode === "pvt" ? "pvt_msg" : "room_msg",
    };
  }

  async fetch(request: Request): Promise<Response> {
    return new Response("Not implemented", { status: 501 });
  }

  // 广播消息到所有连接的客户端
  broadcast(data: any) {
    const stringified = JSON.stringify(data);
    for (const ws of this.state.getWebSockets()) {
      try {
        ws.send(stringified);
      } catch (error) {
        console.error("Error sending message to WebSocket:", error);
      }
    }
  }

  async webSocketMessage(ws: WebSocket, msg: string) {
    const payload = JSON.parse(msg);
    const msgId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    const { isValid, msg: validationMsg } = MessageValidator.validate(
      payload.content,
      +this.env.MSG_ROOM_MAX_LENGTH,
    );
    if (!isValid) {
      ws.send(JSON.stringify({ type: "error", msg: validationMsg }));
      return;
    }

    const chatMsg: BaseMessage = {
      id: msgId,
      userId: payload.userId,
      username: payload.username,
      content: payload.content,
      timestamp: now,
      status: "pending",
      type: "text",
    };

    try {
      // 广播消息到所有连接的客户端
      this.broadcast({ ...chatMsg });
      // 将消息暂存到DO中
      await this.state.storage.put(
        `${this.config.prefix}${now}_${msgId}`,
        chatMsg,
      );
    } catch (error) {
      console.error("Error handling WebSocket message:", error);
    }

    // 设置定时器，批量保存到D1
    try {
      const alarmTime = await this.state.storage.getAlarm();
      if (alarmTime === null) {
        await this.state.storage.setAlarm(now + +this.env.MSG_OPERATION_TIME); // 消息操作限制
      }
    } catch (error) {
      console.error("Error setting alarm:", error);
    }
  }

  async alarm() {
    const now = Math.floor(Date.now() / 1000);

    try {
      const messages = await this.state.storage.list<BaseMessage>({
        prefix: `${this.config.prefix}`,
      });
      const entries = Array.from(messages.entries());

      if (entries.length === 0) return;

      // 更新消息状态为"saved"
      const messagesToSave = entries.map(([_, value]) => {
        value.status = "saved";
        return value;
      });

      // 批量保存到D1
      await this.saveToD1(messagesToSave, this.config.table);

      // 删除保存在DO中的消息
      const keysToDelete = entries.map(([key]) => key);
      await this.state.storage.delete(keysToDelete);
    } catch (error) {
      console.error("Error processing alarm:", error);

      // 写入失败后自动重试
      await this.state.storage.setAlarm(now + +this.env.MSG_OPERATION_TIME);
    }
  }

  async saveToD1(messages: any[], tableName: string) {
    try {
      if (messages.length === 0) return;

      // 使用事务批量插入消息
      const stmt = this.env.DB.prepare(
        `INSERT INTO ${tableName} (id, userId, content, createAt, editedAt, type, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      );

      // 构建批量插入的参数数组并标记消息状态为"saved"
      const batchRequests = messages.map((msg) => {
        return stmt.bind(
          msg.id,
          msg.userId,
          msg.content,
          msg.timestamp,
          msg.editedAt || null,
          msg.type,
          "saved",
        );
      });

      // 批量插入消息，写入失败自动回滚
      await this.env.DB.batch(batchRequests); // batch具有原子性
    } catch (error) {
      console.error("Error saving messages to D1:", error);
      throw error;
    }
  }

  async handleRevokeMessage(msgId: string, timestamp: number) {
    try {
      const bufKey = `${this.config.prefix}${timestamp}_${msgId}`;
      const msg: BaseMessage | undefined = await this.state.storage.get(bufKey);

      if (msg) {
        msg.content = "";
        msg.status = "revoked";
        await this.state.storage.put(bufKey, msg);

        this.broadcast({ type: "revoked", msgId: msgId });
        console.log(`Message ${msgId} revoked from DO buffer`);
      } else {
        console.warn(`Message ${msgId} not found in DO buffer for revocation`);
      }
    } catch (error) {
      console.error("Error revoking message:", error);
    }
  }

  async handleEditMessage(
    ws: WebSocket,
    msgId: string,
    editedContent: string,
    timestamp: number,
  ) {
    const { isValid, msg: validationMsg } = MessageValidator.validate(
      editedContent,
      +this.env.MSG_ROOM_MAX_LENGTH,
    );
    if (!isValid) {
      ws.send(JSON.stringify({ type: "error", msg: validationMsg }));
      return;
    }

    try {
      // 从DO中获取消息
      const bufKey = `${this.config.prefix}${timestamp}_${msgId}`;
      const msg: BaseMessage | null | undefined =
        await this.state.storage.get(bufKey);
      if (!msg) {
        console.warn(`Message ${msgId} not found in DO buffer for editing`);
        return;
      }

      // 更新消息内容和状态
      msg.content = editedContent;
      msg.status = "edited";

      // 保存更新后的消息
      await this.state.storage.put(bufKey, msg);

      // 广播编辑后的消息
      this.broadcast({ ...msg });
      console.log(`Message ${msgId} edited in DO buffer`);
    } catch (error) {
      console.error("Error editing message:", error);
    }
  }
}

/** wrangler.jsonc DO binding 要求的导出类名，与 "class_name": "ChatRoom" 匹配 */
export class ChatRoom extends ChatInstance {}
