/**
 * Test script for OpenAI and Anthropic Admin APIs
 * Run with: npx ts-node server/src/services/aiProviderServices/test-provider-apis.ts
 */

import { OpenAIAdminService } from './openAIAdminService';
import { AnthropicAdminService } from './anthropicAdminService';

async function testOpenAI() {
  console.log('\n=== Testing OpenAI Admin API ===');
  const service = new OpenAIAdminService();
  
  const endDate = new Date();
  const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Last 7 days
  
  try {
    console.log('Fetching usage data...');
    const usage = await service.getUsageData({ startDate, endDate });
    console.log('✅ Usage data received:', JSON.stringify(usage, null, 2));
  } catch (error) {
    console.error('❌ Error fetching usage:', error instanceof Error ? error.message : error);
  }
  
  try {
    console.log('\nFetching billing data...');
    const billing = await service.getBillingData('month');
    console.log('✅ Billing data received:', JSON.stringify(billing, null, 2));
  } catch (error) {
    console.error('❌ Error fetching billing:', error instanceof Error ? error.message : error);
  }
}

async function testAnthropic() {
  console.log('\n=== Testing Anthropic Admin API ===');
  const service = new AnthropicAdminService();
  
  const endDate = new Date();
  const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Last 7 days
  
  try {
    console.log('Fetching usage report...');
    const usage = await service.getUsageReport({ startDate, endDate });
    console.log('✅ Usage report received:', JSON.stringify(usage, null, 2));
  } catch (error) {
    console.error('❌ Error fetching usage:', error instanceof Error ? error.message : error);
  }
  
  try {
    console.log('\nFetching cost report...');
    const cost = await service.getCostReport({ startDate, endDate });
    console.log('✅ Cost report received:', JSON.stringify(cost, null, 2));
  } catch (error) {
    console.error('❌ Error fetching cost:', error instanceof Error ? error.message : error);
  }
}

async function main() {
  console.log('Starting API tests...\n');
  console.log('Environment check:');
  console.log('- OPENAI_ADMIN_API_KEY:', process.env.OPENAI_ADMIN_API_KEY ? '✅ Set' : '❌ Missing');
  console.log('- ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? '✅ Set' : '❌ Missing');
  
  await testOpenAI();
  await testAnthropic();
  
  console.log('\n=== Tests Complete ===');
}

main().catch(console.error);
