import { Context } from "hono";

export async function handleFileUpload(c: Context<{ Bindings: Env }>) {
  try {
    const formData = await c.req.formData();
  } catch {}
}
