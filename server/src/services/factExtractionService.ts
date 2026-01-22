/**
 * Fact Extraction Service
 * 
 * Automatically extracts important facts about users from conversations
 * and saves them to UserAIContext for future reference.
 * Similar to how ChatGPT's Custom Instructions learn from conversations.
 */

import { PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

interface ExtractedFact {
  title: string;
  content: string;
  contextType: 'fact' | 'preference' | 'instruction' | 'workflow';
  priority: number;
  tags: string[];
  scope?: 'personal' | 'business';
}

export class FactExtractionService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = prisma;
  }

  /**
   * Extract facts from a conversation and save to UserAIContext
   * This runs automatically after each AI interaction
   */
  async extractAndSaveFacts(
    userId: string,
    userQuery: string,
    aiResponse: string,
    context?: Record<string, unknown>
  ): Promise<void> {
    try {
      // Skip if this is a very short or non-informative exchange
      if (userQuery.length < 20 && aiResponse.length < 50) {
        return;
      }

      // Get existing context to avoid duplicates
      const existingContexts = await this.prisma.userAIContext.findMany({
        where: {
          userId,
          active: true
        },
        select: {
          title: true,
          content: true,
          contextType: true
        }
      });

      // Extract facts using AI
      const extractedFacts = await this.extractFactsFromConversation(
        userQuery,
        aiResponse,
        existingContexts
      );

      if (!extractedFacts || extractedFacts.length === 0) {
        return;
      }

      // Save new facts that don't already exist
      for (const fact of extractedFacts) {
        // Check if similar fact already exists
        const isDuplicate = existingContexts.some(existing => {
          const titleSimilar = this.isSimilar(existing.title, fact.title);
          const contentSimilar = this.isSimilar(existing.content, fact.content);
          return titleSimilar || contentSimilar;
        });

        if (!isDuplicate && fact.title && fact.content) {
          try {
            await this.prisma.userAIContext.create({
              data: {
                userId,
                scope: fact.scope || 'personal',
                contextType: fact.contextType,
                title: fact.title,
                content: fact.content,
                tags: fact.tags || [],
                priority: fact.priority || 50,
                active: true
              }
            });

            await logger.info('Auto-extracted fact saved', {
              operation: 'fact_extraction',
              userId,
              title: fact.title,
              contextType: fact.contextType
            });
          } catch (saveError) {
            // Log but don't fail - fact extraction is non-critical
            console.warn('Failed to save extracted fact:', saveError);
          }
        }
      }
    } catch (error) {
      // Log but don't fail - fact extraction should never break the main flow
      const err = error instanceof Error ? error : new Error('Unknown error');
      console.warn('Error in fact extraction:', err);
      await logger.warn('Fact extraction failed', {
        operation: 'fact_extraction',
        userId,
        error: { message: err.message, stack: err.stack }
      });
    }
  }

  /**
   * Use AI to extract structured facts from conversation
   */
  private async extractFactsFromConversation(
    userQuery: string,
    aiResponse: string,
    existingContexts: Array<{ title: string; content: string; contextType: string }>
  ): Promise<ExtractedFact[]> {
    try {
      if (!process.env.OPENAI_API_KEY) {
        return [];
      }

      // Build prompt for fact extraction
      const extractionPrompt = `Analyze this conversation and extract important facts about the user that should be remembered for future conversations.

User said: "${userQuery}"
AI responded: "${aiResponse}"

Extract facts like:
- Job title, workplace, role
- Personal information (location, family, interests)
- Preferences (how they like things done, communication style)
- Important relationships or people in their life
- Workflows or processes they use
- Any specific instructions for how to help them

IMPORTANT: Only extract facts that are:
1. Clearly stated or strongly implied
2. Useful for future conversations
3. Not already in the existing context (check existing contexts below)

Existing contexts to avoid duplicating:
${existingContexts.slice(0, 10).map(ctx => `- ${ctx.title}: ${ctx.content.substring(0, 100)}`).join('\n')}

Return a JSON object with a "facts" array in this format:
{
  "facts": [
    {
      "title": "Brief title (e.g., 'My Job Title')",
      "content": "Full fact description",
      "contextType": "fact|preference|instruction|workflow",
      "priority": 50-100,
      "tags": ["relevant", "tags"],
      "scope": "personal|business"
    }
  ]
}

If no important facts found, return { "facts": [] }.`;

      // Call OpenAI with structured output
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are a fact extraction system. Extract important user facts from conversations and return them as JSON only, no other text.'
            },
            {
              role: 'user',
              content: extractionPrompt
            }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3, // Lower temperature for more consistent extraction
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content;
      
      if (!content) {
        return [];
      }

      // Parse JSON response
      let parsed: { facts?: ExtractedFact[] } | ExtractedFact[] = JSON.parse(content);
      
      // Handle different response formats
      if (Array.isArray(parsed)) {
        return parsed;
      } else if (parsed.facts && Array.isArray(parsed.facts)) {
        return parsed.facts;
      }

      return [];
    } catch (error) {
      console.warn('Error extracting facts with AI:', error);
      return [];
    }
  }

  /**
   * Simple similarity check to avoid duplicates
   */
  private isSimilar(text1: string, text2: string): boolean {
    const normalized1 = text1.toLowerCase().trim();
    const normalized2 = text2.toLowerCase().trim();
    
    // Exact match
    if (normalized1 === normalized2) return true;
    
    // Check if one contains the other (for partial matches)
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
      return true;
    }
    
    // Simple word overlap check
    const words1 = new Set(normalized1.split(/\s+/));
    const words2 = new Set(normalized2.split(/\s+/));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    const similarity = intersection.size / union.size;
    
    return similarity > 0.7; // 70% word overlap
  }
}

export const factExtractionService = new FactExtractionService();
