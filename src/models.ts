export interface User {
  id: string;
  username: string;
  password: string;
  salt: string;
  createdAt: string;
}

export interface BaseMessage {
  id: string;
  userId: string;
  username: string;
  content: string;
  timestamp: number;
  editedAt?: number;
  status: "pending" | "saved" | "edited" | "revoked";
  type: "text" | "image" | "file" | "mixed" | "system" | "error";
}

export interface PvtMessage extends BaseMessage {
  pvtftr: string;
}

export interface RoomMessage extends BaseMessage {
  roomftr: string;
}

export type validateResult = {
  valid: boolean;
  msg: string;
};

export interface TurnstileResponse {
  success: boolean;
  "error-codes": string[];
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
}
