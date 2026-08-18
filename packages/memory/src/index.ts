export type MemoryRecord = {
  userId: string;
  app: "chat" | "subtitles" | "voice" | "hub";
  content: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type MemoryClientOptions = {
  apiKey: string;
  baseUrl?: string;
};

export class MiithiiMemoryClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(options: MemoryClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? "https://api.supermemory.ai";
  }

  async remember(record: MemoryRecord) {
    const response = await fetch(`${this.baseUrl}/v1/memories`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(record)
    });

    if (!response.ok) {
      throw new Error(`Supermemory request failed with ${response.status}`);
    }

    return response.json() as Promise<unknown>;
  }
}

