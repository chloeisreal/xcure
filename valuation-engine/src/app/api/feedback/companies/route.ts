import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface FeedbackEntry {
  query: string;
  wrongResult?: string;
  correctResult?: string;
  reportedAt: string;
  status: "pending" | "reviewed" | "fixed";
}

const FEEDBACK_DIR = path.join(process.cwd(), 'data', 'feedback');

function ensureFeedbackDir(): void {
  if (!fs.existsSync(FEEDBACK_DIR)) {
    fs.mkdirSync(FEEDBACK_DIR, { recursive: true });
  }
}

function getFeedbackFile(): string {
  ensureFeedbackDir();
  return path.join(FEEDBACK_DIR, 'companies.json');
}

function loadFeedback(): FeedbackEntry[] {
  const file = getFeedbackFile();
  if (!fs.existsSync(file)) {
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return [];
  }
}

function saveFeedback(feedback: FeedbackEntry[]): void {
  const file = getFeedbackFile();
  fs.writeFileSync(file, JSON.stringify(feedback, null, 2), 'utf-8');
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    
    const feedback: FeedbackEntry = {
      query: body.query,
      wrongResult: body.wrongResult,
      correctResult: body.correctResult,
      reportedAt: new Date().toISOString(),
      status: 'pending',
    };

    const existing = loadFeedback();
    existing.push(feedback);
    saveFeedback(existing);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Feedback error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save feedback' },
      { status: 500 }
    );
  }
}

export async function GET(): Promise<NextResponse> {
  const feedback = loadFeedback();
  return NextResponse.json({ success: true, data: feedback });
}
