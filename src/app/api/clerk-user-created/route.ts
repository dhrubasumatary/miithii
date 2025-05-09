import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { createClerkClient } from '@clerk/backend';
import { env } from '@/env';

const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

interface ClerkUserCreatedEvent {
  type: string;
  data: {
    id: string;
    [key: string]: unknown;
  };
}

export async function POST(req: NextRequest) {
  // Verify webhook signature
  const svix_id = req.headers.get('svix-id');
  const svix_timestamp = req.headers.get('svix-timestamp');
  const svix_signature = req.headers.get('svix-signature');
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json({ error: 'Missing Svix headers' }, { status: 400 });
  }

  const payload = await req.text();
  const webhook = new Webhook(env.CLERK_SECRET_KEY);
  let event: ClerkUserCreatedEvent;
  try {
    event = webhook.verify(payload, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as ClerkUserCreatedEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
  }

  if (event.type === 'user.created') {
    const userId = event.data.id;
    try {
      await clerk.users.updateUserMetadata(userId, {
        publicMetadata: {
          plan_type: 'free',
          token_count: 0,
          language: 'en',
          theme: 'light',
        },
      });
      return NextResponse.json({ success: true });
    } catch {
      return NextResponse.json({ error: 'Failed to set metadata' }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
} 