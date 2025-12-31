'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card } from 'shared/components';
import { adminApiService } from '../../../lib/adminApiService';
import { 
  Play, 
  CheckCircle, 
  XCircle, 
  Clock, 
  FileText,
  Activity,
  TrendingUp,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';

interface TestFile {
  path: string;
  relativePath: string;
  name: string;
}

interface TestResults {
  status: 'completed' | 'running' | 'error';
  results?: {
    testFiles?: { passed: number; total: number };
    tests?: { passed: number; failed: number; total: number };
    raw?: string;
    summary?: Record<string, unknown>;
  };
  error?: string;
  stdout?: string;
  stderr?: string;
  timestamp?: string;
}

interface CoverageInfo {
  overall?: {
    statements: number;
    branches: number;
    functions: number;
  };
  raw?: string;
  timestamp?: string;
}

export default function TestingPage() {
  const { data: session, status } = useSession();
  const [testFiles, setTestFiles] = useState<TestFile[]>([]);
  const [testResults, setTestResults] = useState<TestResults | null>(null);
  const [coverage, setCoverage] = useState<CoverageInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [selectedTestFile, setSelectedTestFile] = useState<string>('');

  useEffect(() => {
    if (status === 'authenticated' && session) {
      loadTestFiles();
      loadTestStatus();
    }
  }, [status, session]);

  const loadTestFiles = async () => {
    try {
      const result = await adminApiService.getTestFiles();
      if (result.data && result.data.testFiles) {
        setTestFiles(result.data.testFiles || []);
      }
    } catch (error) {
      console.error('Error loading test files:', error);
    }
  };

  const loadTestStatus = async () => {
    try {
      const result = await adminApiService.getTestStatus();
      if (result.data) {
        setTestResults(result.data);
      }
    } catch (error) {
      console.error('Error loading test status:', error);
    }
  };

  const runTests = async (testFile?: string) => {
    try {
      setRunning(true);
      setTestResults({ status: 'running' });

      const result = await adminApiService.runTests(testFile);

      if (result.data) {
        setTestResults(result.data);
      } else {
        setTestResults({
          status: 'error',
          error: result.error || 'Failed to run tests'
        });
      }
    } catch (error) {
      console.error('Error running tests:', error);
      setTestResults({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setRunning(false);
    }
  };

  const loadCoverage = async () => {
    try {
      setLoading(true);
      const result = await adminApiService.getTestCoverage();
      
      if (result.data) {
        setCoverage(result.data);
      }
    } catch (error) {
      console.error('Error loading coverage:', error);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Testing</h1>
        <p className="text-gray-600 mt-2">Run and monitor backend unit tests</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => runTests()}
          disabled={running}
          className="p-4 border rounded-lg hover:bg-gray-50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Play className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Run All Tests</h3>
              <p className="text-sm text-gray-600">Execute all test suites</p>
            </div>
          </div>
        </button>

        <button
          onClick={loadCoverage}
          disabled={loading}
          className="p-4 border rounded-lg hover:bg-gray-50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-green-100">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Generate Coverage</h3>
              <p className="text-sm text-gray-600">View test coverage report</p>
            </div>
          </div>
        </button>

        <button
          onClick={loadTestFiles}
          className="p-4 border rounded-lg hover:bg-gray-50 transition-colors text-left"
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-purple-100">
              <RefreshCw className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Refresh List</h3>
              <p className="text-sm text-gray-600">Reload test files</p>
            </div>
          </div>
        </button>
      </div>

      {/* Test Files List */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Test Files</h2>
        {testFiles.length > 0 ? (
          <div className="space-y-2">
            {testFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center space-x-3">
                  <FileText className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900">{file.name}</p>
                    <p className="text-sm text-gray-600">{file.relativePath}</p>
                  </div>
                </div>
                <button
                  onClick={() => runTests(file.relativePath)}
                  disabled={running}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  Run
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-600">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p>No test files found. Click "Refresh List" to load test files.</p>
          </div>
        )}
      </Card>

      {/* Test Results */}
      {testResults && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Test Results</h2>
            {testResults.timestamp && (
              <span className="text-sm text-gray-600">
                {new Date(testResults.timestamp).toLocaleString()}
              </span>
            )}
          </div>

          {testResults.status === 'running' && (
            <div className="flex items-center space-x-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <p className="text-blue-800">Running tests...</p>
            </div>
          )}

          {testResults.status === 'completed' && testResults.results && (
            <div className="space-y-4">
              {/* Summary Stats */}
              {testResults.results.testFiles && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Test Files</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {testResults.results.testFiles.passed} / {testResults.results.testFiles.total}
                    </p>
                  </div>
                  {testResults.results.tests && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Tests</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {testResults.results.tests.passed} / {testResults.results.tests.total}
                      </p>
                      {testResults.results.tests.failed > 0 && (
                        <p className="text-sm text-red-600 mt-1">
                          {testResults.results.tests.failed} failed
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Raw Output */}
              {testResults.results.raw && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Output</h3>
                  <pre className="p-4 bg-gray-900 text-gray-100 rounded-lg overflow-auto text-xs max-h-96">
                    {testResults.results.raw}
                  </pre>
                </div>
              )}
            </div>
          )}

          {testResults.status === 'error' && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-medium text-red-800">Test Execution Failed</h3>
                  <p className="text-sm text-red-700 mt-1">{testResults.error}</p>
                  {testResults.stderr && (
                    <pre className="mt-2 p-2 bg-red-100 rounded text-xs overflow-auto max-h-48">
                      {testResults.stderr}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Coverage Report */}
      {coverage && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Coverage Report</h2>
            {coverage.timestamp && (
              <span className="text-sm text-gray-600">
                {new Date(coverage.timestamp).toLocaleString()}
              </span>
            )}
          </div>

          {coverage.overall ? (
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Statements</p>
                <p className="text-2xl font-bold text-gray-900">
                  {coverage.overall.statements.toFixed(1)}%
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Branches</p>
                <p className="text-2xl font-bold text-gray-900">
                  {coverage.overall.branches.toFixed(1)}%
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Functions</p>
                <p className="text-2xl font-bold text-gray-900">
                  {coverage.overall.functions.toFixed(1)}%
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-yellow-800">Coverage Data Unavailable</h3>
                  <p className="text-sm text-yellow-700 mt-1">
                    Coverage information could not be extracted from the test output.
                  </p>
                </div>
              </div>
            </div>
          )}

          {coverage.raw && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Raw Output</h3>
              <pre className="p-4 bg-gray-900 text-gray-100 rounded-lg overflow-auto text-xs max-h-96">
                {coverage.raw}
              </pre>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

