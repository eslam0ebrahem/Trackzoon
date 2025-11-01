import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // In a real application, you would fetch logs from a file, database, or logging service.
    // For now, returning a dummy log entry.
    const dummyLogs = [
      {
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: 'Dummy log entry: System started.',
      },
      {
        timestamp: new Date(Date.now() - 60 * 1000).toISOString(), // 1 minute ago
        level: 'WARN',
        message: 'Dummy log entry: High CPU usage detected.',
      },
    ];
    return NextResponse.json(dummyLogs);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
