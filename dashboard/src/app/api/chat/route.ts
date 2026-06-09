import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { messages, conversationId } = await req.json();
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Missing messages" }, { status: 400 });
    }

    const lastMessage = messages[messages.length - 1];
    const prompt = lastMessage.content;
    const cid = conversationId || "cso-strategy-session";

    const backendUrl = process.env.BACKEND_URL || "http://localhost:3141";
    const response = await fetch(`${backendUrl}/agents/cso-intel-assistant/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: prompt,
        options: {
          memory: {
            conversationId: cid,
            userId: "cso-user",
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: `Hono error: ${errorText}` }, { status: response.status });
    }

    // Pipe the SSE stream back to the Next.js client
    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error in Next.js chat proxy API:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
