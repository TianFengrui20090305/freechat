export interface User {
  id: string;
  username: string;
  password: string;
  salt: string;
  avatar_id: string;
  bio: string;
  invcode_id: number | null;
  is_disabled: number;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface PublicUser {
  id: string;
  username: string;
  avatar_id: string;
  bio: string;
  createdAt: number;
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
