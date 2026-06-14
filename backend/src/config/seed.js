import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from './db.js';
import User from '../models/User.model.js';
import Group from '../models/Group.model.js';
import Expense from '../models/Expense.model.js';
import Settlement from '../models/Settlement.model.js';
import ImportLog from '../models/ImportLog.model.js';
import AuditLog from '../models/AuditLog.model.js';

dotenv.config();

const seedData = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/expense_app');
    console.log('Database connected for seeding...');

    // Clear existing data
    await User.deleteMany({});
    await Group.deleteMany({});
    await Expense.deleteMany({});
    await Settlement.deleteMany({});
    await ImportLog.deleteMany({});
    await AuditLog.deleteMany({});
    console.log('Cleared existing database collections.');

    // 1. Create Users
    const usersData = [
      { name: 'Aisha', email: 'aisha@example.com', password: 'password123', avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Aisha' },
      { name: 'Rohan', email: 'rohan@example.com', password: 'password123', avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Rohan' },
      { name: 'Priya', email: 'priya@example.com', password: 'password123', avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Priya' },
      { name: 'Meera', email: 'meera@example.com', password: 'password123', avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Meera' },
      { name: 'Dev', email: 'dev@example.com', password: 'password123', avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Dev' },
      { name: 'Sam', email: 'sam@example.com', password: 'password123', avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Sam' },
    ];

    const users = [];
    for (const u of usersData) {
      const createdUser = await User.create(u);
      users.push(createdUser);
    }
    console.log(`Created ${users.length} seed users.`);

    // Map by name for ease of access
    const userMap = {};
    users.forEach(u => {
      userMap[u.name] = u;
    });

    // 2. Create Group with historical membership timeline
    // Meera joins Feb 1, leaves Mar 29, 2026
    // Sam joins Apr 8, 2026
    // Aisha, Rohan, Priya, Dev join Feb 1, 2026
    const groupMembers = [
      { user: userMap['Aisha']._id, joinedAt: new Date('2026-02-01'), status: 'ACTIVE' },
      { user: userMap['Rohan']._id, joinedAt: new Date('2026-02-01'), status: 'ACTIVE' },
      { user: userMap['Priya']._id, joinedAt: new Date('2026-02-01'), status: 'ACTIVE' },
      { user: userMap['Meera']._id, joinedAt: new Date('2026-02-01'), leftAt: new Date('2026-03-29'), status: 'LEFT' },
      { user: userMap['Dev']._id, joinedAt: new Date('2026-02-01'), status: 'ACTIVE' },
      { user: userMap['Sam']._id, joinedAt: new Date('2026-04-08'), status: 'ACTIVE' },
    ];

    const group = await Group.create({
      name: 'Flatmates Hub',
      description: 'Shared expenses ledger for flatmates and trip split activities.',
      createdBy: userMap['Aisha']._id,
      members: groupMembers
    });
    console.log(`Created Group: "${group.name}" with ID: ${group._id}`);

    // 3. Create a couple of default expenses to start with
    const sampleExpenses = [
      {
        group: group._id,
        title: 'February rent prepay',
        description: 'Rent split among flatmates',
        amount: 48000,
        currency: 'INR',
        exchangeRate: 1.0,
        amountInINR: 48000,
        paidBy: userMap['Aisha']._id,
        expenseDate: new Date('2026-02-01'),
        splitType: 'equal',
        participants: [
          { user: userMap['Aisha']._id, shareAmount: 12000 },
          { user: userMap['Rohan']._id, shareAmount: 12000 },
          { user: userMap['Priya']._id, shareAmount: 12000 },
          { user: userMap['Meera']._id, shareAmount: 12000 },
        ]
      },
      {
        group: group._id,
        title: 'Wifi bill Feb',
        description: 'Internet router bill',
        amount: 1199,
        currency: 'INR',
        exchangeRate: 1.0,
        amountInINR: 1199,
        paidBy: userMap['Rohan']._id,
        expenseDate: new Date('2026-02-05'),
        splitType: 'equal',
        participants: [
          { user: userMap['Aisha']._id, shareAmount: 299.75 },
          { user: userMap['Rohan']._id, shareAmount: 299.75 },
          { user: userMap['Priya']._id, shareAmount: 299.75 },
          { user: userMap['Meera']._id, shareAmount: 299.75 },
        ]
      }
    ];

    for (const exp of sampleExpenses) {
      await Expense.create(exp);
    }
    console.log('Created sample startup expenses.');

    console.log('Database Seeding Completed Successfully.');
    process.exit(0);
  } catch (error) {
    console.error(`Error seeding database: ${error.message}`);
    process.exit(1);
  }
};

seedData();
