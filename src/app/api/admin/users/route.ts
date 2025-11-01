import { NextResponse } from 'next/server';
import User from '@/lib/models/User';
import mongoose from 'mongoose';

// Helper function to ensure DB connection
async function connectDb() {
  if (mongoose.connection.readyState !== 1) {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined');
    }
    await mongoose.connect(process.env.MONGODB_URI);
  }
}

export async function GET() {
  try {
    await connectDb();
    const users = await User.find({});
    return NextResponse.json(users);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await connectDb();
    const { _id, ...updateData } = await request.json();

    if (!_id) {
      return NextResponse.json({ error: 'User ID is required for update' }, { status: 400 });
    }

    const updatedUser = await User.findByIdAndUpdate(_id, updateData, { new: true });

    if (!updatedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await connectDb();
    const { _id } = await request.json();

    if (!_id) {
      return NextResponse.json({ error: 'User ID is required for deletion' }, { status: 400 });
    }

    const deletedUser = await User.findByIdAndDelete(_id);

    if (!deletedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}