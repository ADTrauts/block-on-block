'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { 
  Brain, 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  User, 
  Briefcase, 
  Heart, 
  Zap,
  Shield,
  Clock,
  MessageSquare,
  Users,
  Target,
  Lightbulb
} from 'lucide-react';
import { Card, Button, Badge, Spinner } from 'shared/components';
import { authenticatedApiCall } from '../../lib/apiUtils';

interface PersonalityData {
  traits: Record<string, number>;
  preferences: Record<string, unknown>;
  communicationStyle?: string;
  workStyle?: string;
  learningStyle?: string;
  autonomySettings?: Record<string, unknown>;
}

interface PersonalityQuestionnaireProps {
  onComplete: (personalityData: PersonalityData) => void;
  onSkip?: () => void;
}

interface QuestionSection {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: string | number; className?: string }>;
  questions: Question[];
}

interface Question {
  id: string;
  type: 'scale' | 'choice' | 'multiple' | 'text';
  question: string;
  description?: string;
  options?: string[];
  scale?: { min: number; max: number; labels: string[] };
  required?: boolean;
}

interface Answer {
  questionId: string;
  value: string | number | string[];
  score?: number;
}

const questionSections: QuestionSection[] = [
  {
    id: 'basic_traits',
    title: 'Your Personality',
    description: 'Help us understand your core personality traits',
    icon: User,
    questions: [
      {
        id: 'openness',
        type: 'scale',
        question: 'How open are you to new experiences?',
        description: 'This affects how your AI approaches innovation and creativity',
        scale: { min: 1, max: 10, labels: ['Traditional', 'Adventurous'] },
        required: true
      },
      {
        id: 'conscientiousness',
        type: 'scale',
        question: 'How organized and detail-oriented are you?',
        description: 'This influences how your AI manages tasks and schedules',
        scale: { min: 1, max: 10, labels: ['Flexible', 'Structured'] },
        required: true
      },
      {
        id: 'extraversion',
        type: 'scale',
        question: 'How social and outgoing are you?',
        description: 'This affects how your AI handles communication and networking',
        scale: { min: 1, max: 10, labels: ['Introverted', 'Extraverted'] },
        required: true
      },
      {
        id: 'agreeableness',
        type: 'scale',
        question: 'How cooperative and trusting are you?',
        description: 'This influences how your AI approaches relationships and conflicts',
        scale: { min: 1, max: 10, labels: ['Competitive', 'Cooperative'] },
        required: true
      },
      {
        id: 'risk_tolerance',
        type: 'scale',
        question: 'How comfortable are you with taking risks?',
        description: 'This determines how bold your AI will be in making suggestions',
        scale: { min: 1, max: 10, labels: ['Risk-Averse', 'Risk-Taking'] },
        required: true
      }
    ]
  },
  {
    id: 'work_style',
    title: 'Work & Productivity',
    description: 'Tell us about your work preferences and style',
    icon: Briefcase,
    questions: [
      {
        id: 'work_hours',
        type: 'choice',
        question: 'When are you most productive?',
        options: ['Early morning (6-9 AM)', 'Morning (9-12 PM)', 'Afternoon (12-5 PM)', 'Evening (5-9 PM)', 'Late night (9 PM+)', 'It varies'],
        required: true
      },
      {
        id: 'meeting_preference',
        type: 'scale',
        question: 'How do you feel about meetings?',
        description: 'This affects how your AI schedules and manages meetings',
        scale: { min: 1, max: 10, labels: ['Avoid meetings', 'Love meetings'] },
        required: true
      },
      {
        id: 'collaboration_style',
        type: 'choice',
        question: 'How do you prefer to work?',
        options: ['Mostly alone', 'Small teams (2-4 people)', 'Medium teams (5-10 people)', 'Large teams (10+ people)', 'Mix of solo and team work'],
        required: true
      },
      {
        id: 'decision_making',
        type: 'choice',
        question: 'How do you prefer to make decisions?',
        options: ['Quick decisions with minimal info', 'Balanced approach', 'Thorough analysis before deciding', 'Collaborative decision making', 'Delegate decisions when possible'],
        required: true
      },
      {
        id: 'interruption_tolerance',
        type: 'scale',
        question: 'How do you handle interruptions during focused work?',
        description: 'This affects when your AI will notify you or take actions',
        scale: { min: 1, max: 10, labels: ['Hate interruptions', 'Welcome interruptions'] },
        required: true
      }
    ]
  },
  {
    id: 'communication',
    title: 'Communication Style',
    description: 'How do you like to communicate and be communicated with?',
    icon: MessageSquare,
    questions: [
      {
        id: 'communication_formality',
        type: 'choice',
        question: 'What communication style do you prefer?',
        options: ['Very formal and professional', 'Professional but friendly', 'Casual and conversational', 'Depends on the context', 'Very casual and informal'],
        required: true
      },
      {
        id: 'response_speed',
        type: 'choice',
        question: 'How quickly do you typically respond to messages?',
        options: ['Immediately (within minutes)', 'Within a few hours', 'Within a day', 'Within a few days', 'When I can get to it'],
        required: true
      },
      {
        id: 'conflict_approach',
        type: 'choice',
        question: 'How do you approach conflicts or disagreements?',
        options: ['Address directly and immediately', 'Think it through then address', 'Try to find compromise', 'Avoid conflict when possible', 'Seek mediation or help'],
        required: true
      },
      {
        id: 'feedback_style',
        type: 'choice',
        question: 'How do you prefer to give and receive feedback?',
        options: ['Direct and straightforward', 'Constructive with examples', 'Gentle and supportive', 'Written rather than verbal', 'In private settings'],
        required: true
      }
    ]
  },
  {
    id: 'ai_autonomy',
    title: 'AI Autonomy Preferences',
    description: 'How much independence should your Digital Life Twin have?',
    icon: Zap,
    questions: [
      {
        id: 'general_autonomy',
        type: 'scale',
        question: 'How much should your AI act independently?',
        description: 'This sets the baseline for all AI autonomy',
        scale: { min: 1, max: 10, labels: ['Always ask first', 'Act independently'] },
        required: true
      },
      {
        id: 'scheduling_autonomy',
        type: 'scale',
        question: 'Can your AI schedule meetings and events for you?',
        scale: { min: 1, max: 10, labels: ['Never schedule', 'Full scheduling power'] },
        required: true
      },
      {
        id: 'communication_autonomy',
        type: 'scale',
        question: 'Can your AI send messages and emails on your behalf?',
        scale: { min: 1, max: 10, labels: ['Never send', 'Send freely'] },
        required: true
      },
      {
        id: 'file_autonomy',
        type: 'scale',
        question: 'Can your AI organize and manage your files?',
        scale: { min: 1, max: 10, labels: ['Never touch files', 'Full file management'] },
        required: true
      },
      {
        id: 'financial_threshold',
        type: 'choice',
        question: 'What financial decisions require your approval?',
        options: ['Any amount over $0', 'Over $10', 'Over $50', 'Over $100', 'Over $500', 'I trust my AI completely'],
        required: true
      }
    ]
  },
  {
    id: 'life_priorities',
    title: 'Life Priorities',
    description: 'What matters most to you? This helps your AI make better decisions.',
    icon: Heart,
    questions: [
      {
        id: 'work_life_balance',
        type: 'scale',
        question: 'How important is work-life balance to you?',
        scale: { min: 1, max: 10, labels: ['Work comes first', 'Life comes first'] },
        required: true
      },
      {
        id: 'family_priority',
        type: 'scale',
        question: 'How high priority is family time?',
        scale: { min: 1, max: 10, labels: ['Low priority', 'Highest priority'] },
        required: true
      },
      {
        id: 'career_ambition',
        type: 'scale',
        question: 'How career-focused are you?',
        scale: { min: 1, max: 10, labels: ['Work to live', 'Live to work'] },
        required: true
      },
      {
        id: 'health_wellness',
        type: 'scale',
        question: 'How important is health and wellness?',
        scale: { min: 1, max: 10, labels: ['Not a focus', 'Top priority'] },
        required: true
      },
      {
        id: 'learning_growth',
        type: 'scale',
        question: 'How important is continuous learning and growth?',
        scale: { min: 1, max: 10, labels: ['Comfortable as is', 'Always growing'] },
        required: true
      }
    ]
  }
];

export default function PersonalityQuestionnaire({ onComplete, onSkip }: PersonalityQuestionnaireProps) {
  const { data: session } = useSession();
  const [currentSection, setCurrentSection] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentSectionData = questionSections[currentSection];
  const isLastSection = currentSection === questionSections.length - 1;
  const totalQuestions = questionSections.reduce((sum, section) => sum + section.questions.length, 0);
  const answeredQuestions = Object.keys(answers).length;
  const progress = (answeredQuestions / totalQuestions) * 100;

  const handleAnswer = (questionId: string, value: string | number | string[]) => {
    let score = 0;
    
    // Convert answers to numerical scores for personality traits
    if (typeof value === 'number') {
      score = value;
    } else if (Array.isArray(value)) {
      score = value.length; // For multiple choice, count selections
    } else {
      // For text/choice answers, assign scores based on context
      score = 5; // Default middle value
    }

    setAnswers(prev => ({
      ...prev,
      [questionId]: { questionId, value, score }
    }));
  };

  const canProceed = () => {
    const requiredQuestions = currentSectionData.questions.filter(q => q.required);
    return requiredQuestions.every(q => answers[q.id]);
  };

  const nextSection = () => {
    if (currentSection < questionSections.length - 1) {
      setCurrentSection(prev => prev + 1);
    }
  };

  const prevSection = () => {
    if (currentSection > 0) {
      setCurrentSection(prev => prev - 1);
    }
  };

  const calculatePersonalityTraits = () => {
    const traits = {
      openness: answers['openness']?.score || 50,
      conscientiousness: answers['conscientiousness']?.score || 50,
      extraversion: answers['extraversion']?.score || 50,
      agreeableness: answers['agreeableness']?.score || 50,
      neuroticism: 50, // Not directly measured, use default
      autonomyPreference: (answers['general_autonomy']?.score || 5) * 10,
      riskTolerance: (answers['risk_tolerance']?.score || 5) * 10,
      detailOrientation: (answers['conscientiousness']?.score || 5) * 10,
      planningHorizon: (answers['conscientiousness']?.score || 5) * 10,
      collaborationStyle: answers['collaboration_style']?.value === 'Mostly alone' ? 20 : 
                          answers['collaboration_style']?.value === 'Small teams (2-4 people)' ? 40 :
                          answers['collaboration_style']?.value === 'Medium teams (5-10 people)' ? 60 :
                          answers['collaboration_style']?.value === 'Large teams (10+ people)' ? 80 : 50
    };

    const preferences = {
      communication: {
        formality: answers['communication_formality']?.value || 'professional but friendly',
        responseSpeed: answers['response_speed']?.value || 'within a few hours',
        conflictStyle: answers['conflict_approach']?.value || 'try to find compromise',
        notificationLevel: (answers['interruption_tolerance']?.score || 5) > 7 ? 'high' : 
                          (answers['interruption_tolerance']?.score || 5) > 4 ? 'moderate' : 'minimal'
      },
      work: {
        preferredHours: answers['work_hours']?.value || 'Morning (9-12 PM)',
        focusBlockDuration: (answers['interruption_tolerance']?.score || 5) < 4 ? 120 : 60,
        meetingTolerance: (answers['meeting_preference']?.score || 5) > 7 ? 'high' : 
                         (answers['meeting_preference']?.score || 5) > 4 ? 'moderate' : 'minimal',
        interruptionHandling: (answers['interruption_tolerance']?.score || 5) > 7 ? 'immediate' : 'batched'
      },
      life: {
        familyPriority: answers['family_priority']?.score || 8,
        careerFocus: answers['career_ambition']?.score || 7,
        healthWellness: answers['health_wellness']?.score || 6,
        socialConnections: answers['extraversion']?.score || 6,
        personalGrowth: answers['learning_growth']?.score || 5,
        financialSecurity: 7 // Default value
      },
      decision: {
        informationNeeds: answers['decision_making']?.value === 'Thorough analysis before deciding' ? 'comprehensive' :
                         answers['decision_making']?.value === 'Quick decisions with minimal info' ? 'minimal' : 'moderate',
        consultationStyle: answers['decision_making']?.value === 'Collaborative decision making' ? 'collaborative' :
                          answers['decision_making']?.value === 'Delegate decisions when possible' ? 'delegative' : 'independent',
        timeframePreference: 'planned'
      }
    };

    return { traits, preferences };
  };

  const calculateAutonomySettings = () => {
    const financialThresholds = {
      'Any amount over $0': 0,
      'Over $10': 10,
      'Over $50': 50,
      'Over $100': 100,
      'Over $500': 500,
      'I trust my AI completely': 10000
    };

    return {
      scheduling: (answers['scheduling_autonomy']?.score || 3) * 10,
      communication: (answers['communication_autonomy']?.score || 2) * 10,
      fileManagement: (answers['file_autonomy']?.score || 4) * 10,
      taskCreation: (answers['general_autonomy']?.score || 3) * 10,
      dataAnalysis: 60, // Default high value
      crossModuleActions: (answers['general_autonomy']?.score || 2) * 10,
      financialThreshold: financialThresholds[answers['financial_threshold']?.value as keyof typeof financialThresholds] || 0,
      timeCommitmentThreshold: 60, // Default 1 hour
      peopleAffectedThreshold: 1 // Default requiring approval if others affected
    };
  };

  const submitQuestionnaire = async () => {
    if (!session?.accessToken) {
      setError('Please sign in to save your personality profile');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const personalityData = calculatePersonalityTraits();
      const autonomyData = calculateAutonomySettings();

      // Save personality profile
      await authenticatedApiCall(
        '/api/ai/personality/profile',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            personalityData: {
              traits: personalityData.traits,
              preferences: personalityData.preferences,
              communicationStyle: (personalityData as PersonalityData).communicationStyle,
              workStyle: (personalityData as PersonalityData).workStyle,
              learningStyle: (personalityData as PersonalityData).learningStyle,
              answers: Object.values(answers),
              questionnaireCompleted: true,
              completedAt: new Date().toISOString()
            }
          })
        },
        session.accessToken
      );

      // Save autonomy settings
      await authenticatedApiCall(
        '/api/ai/autonomy',
        {
          method: 'PUT',
          body: JSON.stringify(autonomyData)
        },
        session.accessToken
      );

      onComplete({ ...personalityData, autonomySettings: autonomyData });
    } catch (error) {
      console.error('Failed to submit questionnaire:', error);
      setError('Failed to save your personality profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderQuestion = (question: Question) => {
    const currentAnswer = answers[question.id];

    return (
      <div key={question.id} className="space-y-4">
        <div>
          <h4 className="text-lg font-medium text-gray-900">{question.question}</h4>
          {question.description && (
            <p className="text-sm text-gray-600 mt-1">{question.description}</p>
          )}
        </div>

        {question.type === 'scale' && question.scale && (
          <div className="space-y-3">
            <div className="flex justify-between text-sm text-gray-600">
              <span>{question.scale.labels[0]}</span>
              <span>{question.scale.labels[1]}</span>
            </div>
            <div className="px-2">
              <input
                type="range"
                min={question.scale.min}
                max={question.scale.max}
                value={currentAnswer?.value || 5}
                onChange={(e) => handleAnswer(question.id, parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <div className="text-center">
              <span className="text-lg font-semibold text-blue-600">
                {currentAnswer?.value || 5}
              </span>
            </div>
          </div>
        )}

        {question.type === 'choice' && question.options && (
          <div className="space-y-2">
            {question.options.map((option, index) => (
              <label key={index} className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name={question.id}
                  value={option}
                  checked={currentAnswer?.value === option}
                  onChange={(e) => handleAnswer(question.id, e.target.value)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700">{option}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center mb-4">
          <Brain className="h-12 w-12 text-blue-600 mr-3" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Set Up Your Digital Life Twin</h1>
            <p className="text-gray-600 mt-2">
              Help us understand you so your AI can represent you perfectly
            </p>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-sm text-gray-600">
          {answeredQuestions} of {totalQuestions} questions answered
        </p>
      </div>

      {/* Section Navigation */}
      <div className="flex items-center justify-center mb-8 space-x-1 overflow-x-auto">
        {questionSections.map((section, index) => {
          const Icon = section.icon;
          const isActive = index === currentSection;
          const isCompleted = section.questions.every(q => answers[q.id]);
          
          return (
            <div key={section.id} className="flex items-center">
              <button
                onClick={() => setCurrentSection(index)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive 
                    ? 'bg-blue-100 text-blue-700' 
                    : isCompleted 
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{section.title}</span>
                {isCompleted && <Check className="h-4 w-4" />}
              </button>
              {index < questionSections.length - 1 && (
                <ChevronRight className="h-4 w-4 text-gray-400 mx-1" />
              )}
            </div>
          );
        })}
      </div>

      {/* Current Section */}
      <Card className="p-8 mb-6">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <currentSectionData.icon className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{currentSectionData.title}</h2>
              <p className="text-gray-600">{currentSectionData.description}</p>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {currentSectionData.questions.map(renderQuestion)}
        </div>
      </Card>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            onClick={prevSection}
            disabled={currentSection === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          
          {onSkip && (
            <Button variant="ghost" onClick={onSkip}>
              Skip for now
            </Button>
          )}
        </div>

        <div className="flex items-center space-x-4">
          {isLastSection ? (
            <Button
              variant="primary"
              onClick={submitQuestionnaire}
              disabled={!canProceed() || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Spinner size={16} />
                  Saving...
                </>
              ) : (
                <>
                  Complete Setup
                  <Check className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={nextSection}
              disabled={!canProceed()}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </div>

      {/* Section Preview */}
      <div className="mt-8 text-center text-sm text-gray-500">
        {currentSection + 1} of {questionSections.length} sections •{' '}
        {currentSectionData.questions.length} questions in this section
      </div>
    </div>
  );
}