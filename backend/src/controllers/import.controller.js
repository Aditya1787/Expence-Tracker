import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { analyzeCSV, finalizeImport } from '../services/import.service.js';
import ImportLog from '../models/ImportLog.model.js';

// Setup Multer destination directory
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
    cb(null, true);
  } else {
    cb(new Error('Please upload only CSV files'), false);
  }
};

export const upload = multer({ storage, fileFilter });

// @desc    Upload CSV and run anomaly check validation
// @route   POST /api/import
// @access  Private
export const importCSV = async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400);
      throw new Error('Please upload a CSV file');
    }

    const { groupId } = req.body;
    if (!groupId) {
      // Remove temp file
      fs.unlinkSync(req.file.path);
      res.status(400);
      throw new Error('Group ID is required');
    }

    // Call analyzeCSV service
    const report = await analyzeCSV(req.file.path, groupId);

    // Keep filepath in report so the frontend can reference it or finalize
    report.tempFilePath = req.file.path;

    res.json({
      success: true,
      report,
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(error);
  }
};

// @desc    Finalize the CSV import after user reviews anomalies
// @route   POST /api/import/finalize
// @access  Private
export const finalizeCSVImport = async (req, res, next) => {
  try {
    const { groupId, resolvedRows, tempFilePath } = req.body;

    if (!groupId || !resolvedRows) {
      res.status(400);
      throw new Error('Group ID and resolvedRows are required');
    }

    const result = await finalizeImport(groupId, req.user._id, resolvedRows);

    // Remove temporary CSV file if filePath was passed
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    res.json({
      success: true,
      message: 'CSV Import finalized successfully',
      result,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get import reports / logs
// @route   GET /api/import/report/:id
// @access  Private
export const getImportReport = async (req, res, next) => {
  try {
    // Simply fetch all logs stored in DB
    const logs = await ImportLog.find().sort({ createdAt: -1 }).limit(100);
    res.json({
      success: true,
      count: logs.length,
      logs,
    });
  } catch (error) {
    next(error);
  }
};
