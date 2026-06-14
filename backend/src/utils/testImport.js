import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Group from '../models/Group.model.js';
import { analyzeCSV } from '../services/import.service.js';

dotenv.config();

const runTest = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/expense_app');
    console.log('Database connected for testing CSV Import...');

    const group = await Group.findOne({ name: 'Flatmates Hub' });
    if (!group) {
      console.error('Flatmates Hub group not found! Please run "npm run seed" first.');
      process.exit(1);
    }

    const csvPath = path.resolve('../Expenses Export.csv');
    console.log(`Analyzing CSV file: ${csvPath}`);

    const report = await analyzeCSV(csvPath, group._id);
    
    console.log('\n================ CSV IMPORT REPORT ================');
    console.log(`Total Rows Processed: ${report.totalRows}`);
    console.log(`Warnings Flagged   : ${report.warningsCount}`);
    console.log(`Errors Flagged     : ${report.errorsCount}`);
    console.log('==================================================\n');

    console.log('Row-by-Row Analysis:\n');
    report.rows.forEach(row => {
      const issueString = row.anomalies.map(a => `[${a.issueType}] -> ${a.actionTaken}`).join('; ');
      console.log(`Row ${row.rowNumber.toString().padEnd(4)} | Status: ${row.status.padEnd(8)} | Issues: ${issueString || 'None'}`);
    });

    console.log('\n==================================================');
    process.exit(0);
  } catch (error) {
    console.error(`Import Analysis Test Failed: ${error.message}`);
    process.exit(1);
  }
};

runTest();
