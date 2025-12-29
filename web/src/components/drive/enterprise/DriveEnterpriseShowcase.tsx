import React, { useState } from 'react';
import { Card, Button } from 'shared/components';
import { useFeatureGating } from '../../../hooks/useFeatureGating';
import { FeatureGate } from '../../FeatureGate';
import { FeatureBadge } from '../../EnterpriseUpgradePrompt';
import { 
  Shield, 
  Share, 
  BarChart3, 
  Tag, 
  Eye, 
  Lock, 
  Clock, 
  Users,
  CheckCircle,
  ArrowRight,
  Zap
} from 'lucide-react';

interface DriveEnterpriseShowcaseProps {
  businessId?: string;
  onUpgrade?: () => void;
}

const ENTERPRISE_FEATURES = [
  {
    id: 'drive_advanced_sharing',
    name: 'Advanced File Sharing',
    description: 'Granular permissions, expiration dates, password protection, and share analytics',
    icon: <Share className="w-6 h-6" />,
    color: 'text-blue-600 bg-blue-50',
    benefits: [
      'Granular permission controls (view/edit/comment/download)',
      'Link expiration dates and password protection',
      'External sharing with domain whitelist',
      'Share analytics and access tracking',
      'Guest access with limited permissions'
    ]
  },
  {
    id: 'drive_audit_logs',
    name: 'File Audit Logs',
    description: 'Complete file access tracking and compliance reporting',
    icon: <BarChart3 className="w-6 h-6" />,
    color: 'text-green-600 bg-green-50',
    benefits: [
      'Complete file access tracking',
      'Compliance reporting (GDPR, HIPAA)',
      'Data retention policies',
      'Legal hold capabilities',
      'Risk assessment and monitoring'
    ]
  },
  {
    id: 'drive_dlp',
    name: 'Data Loss Prevention',
    description: 'AI-powered sensitive data detection and policy enforcement',
    icon: <Shield className="w-6 h-6" />,
    color: 'text-purple-600 bg-purple-50',
    benefits: [
      'Sensitive data detection (SSN, credit cards, etc.)',
      'Content scanning and blocking',
      'Policy enforcement and alerts',
      'Quarantine and review workflows',
      'Automated compliance classification'
    ]
  },
  {
    id: 'drive_advanced_search',
    name: 'Advanced Search',
    description: 'Full-text search across documents with AI-powered insights',
    icon: <Eye className="w-6 h-6" />,
    color: 'text-orange-600 bg-orange-50',
    benefits: [
      'Full-text search across all document types',
      'AI-powered content insights',
      'Advanced filtering and faceted search',
      'Search within file content',
      'Saved searches and alerts'
    ]
  },
  {
    id: 'drive_retention_policies',
    name: 'Data Retention Policies',
    description: 'Automated data retention and compliance management',
    icon: <Clock className="w-6 h-6" />,
    color: 'text-red-600 bg-red-50',
    benefits: [
      'Automated data retention and cleanup',
      'Compliance-based retention rules',
      'Legal hold management',
      'Data lifecycle automation',
      'Audit-ready retention reporting'
    ]
  },
  {
    id: 'drive_advanced_versioning',
    name: 'Advanced Version Control',
    description: 'Branching, merging, and collaborative editing',
    icon: <Users className="w-6 h-6" />,
    color: 'text-indigo-600 bg-indigo-50',
    benefits: [
      'Branching and merging for documents',
      'Compare versions with diff highlighting',
      'Rollback to any point in history',
      'Collaborative editing with conflict resolution',
      'Version approval workflows'
    ]
  }
];

export const DriveEnterpriseShowcase: React.FC<DriveEnterpriseShowcaseProps> = ({
  businessId,
  onUpgrade
}) => {
  const { hasFeature } = useFeatureGating(businessId);
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);

  const handleFeatureClick = (featureId: string) => {
    setExpandedFeature(expandedFeature === featureId ? null : featureId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center py-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="p-3 bg-purple-100 rounded-lg">
            <Shield className="w-8 h-8 text-purple-600" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Enterprise File Hub Features</h2>
            <p className="text-gray-600 mt-2">
              Professional-grade file management with advanced security and compliance
            </p>
          </div>
        </div>
        
        <div className="flex items-center justify-center gap-2 mb-6">
          <FeatureBadge tier="enterprise" hasAccess={false} />
          <span className="text-gray-600">•</span>
          <span className="text-sm text-gray-600">Starting at $99/month</span>
          <span className="text-gray-600">•</span>
          <span className="text-sm text-gray-600">14-day free trial</span>
        </div>
        
        {onUpgrade && (
          <Button onClick={onUpgrade} size="lg" className="mb-8">
            Start Free Trial
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {ENTERPRISE_FEATURES.map((feature) => (
          <FeatureGate 
            key={feature.id} 
            feature={feature.id} 
            businessId={businessId}
            showUpgradePrompt={false}
            fallback={
              <Card 
                className="p-6 cursor-pointer hover:shadow-lg transition-all border-2 border-dashed border-gray-200 hover:border-purple-300"
              >
                <div onClick={() => handleFeatureClick(feature.id)}>
                <div className="text-center">
                  <div className={`inline-flex p-3 rounded-lg mb-4 ${feature.color}`}>
                    {feature.icon}
                  </div>
                  
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{feature.name}</h3>
                    <Lock className="w-4 h-4 text-purple-600" />
                  </div>
                  
                  <p className="text-gray-600 text-sm mb-4">{feature.description}</p>
                  
                  {expandedFeature === feature.id && (
                    <div className="mb-4">
                      <h4 className="font-medium text-gray-900 mb-2 text-left">What you get:</h4>
                      <ul className="text-left space-y-1">
                        {feature.benefits.slice(0, 3).map((benefit, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span>{benefit}</span>
                          </li>
                        ))}
                        {feature.benefits.length > 3 && (
                          <li className="text-sm text-purple-600 font-medium">
                            +{feature.benefits.length - 3} more features
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-center gap-2 text-purple-600 font-medium">
                    <span>Upgrade to unlock</span>
                    <Zap className="w-4 h-4" />
                  </div>
                </div>
                </div>
              </Card>
            }
          >
            <Card className="p-6 border-2 border-green-200 bg-green-50">
              <div className="text-center">
                <div className={`inline-flex p-3 rounded-lg mb-4 ${feature.color}`}>
                  {feature.icon}
                </div>
                
                <div className="flex items-center justify-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">{feature.name}</h3>
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
                
                <p className="text-gray-600 text-sm mb-4">{feature.description}</p>
                
                <div className="flex items-center justify-center gap-2 text-green-600 font-medium">
                  <span>Available</span>
                  <CheckCircle className="w-4 h-4" />
                </div>
              </div>
            </Card>
          </FeatureGate>
        ))}
      </div>

      {/* Enterprise Benefits Summary */}
      <Card className="p-8 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200">
        <div className="text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            Complete Enterprise File Management
          </h3>
          <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
            Get all enterprise File Hub features plus advanced analytics, compliance reporting, 
            and AI-powered insights to protect your business data and meet regulatory requirements.
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">99.9%</div>
              <div className="text-sm text-gray-600">Uptime SLA</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">SOC 2</div>
              <div className="text-sm text-gray-600">Compliance</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">24/7</div>
              <div className="text-sm text-gray-600">Support</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">∞</div>
              <div className="text-sm text-gray-600">Storage</div>
            </div>
          </div>
          
          {onUpgrade && (
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={onUpgrade} size="lg">
                Start Free Trial
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button variant="secondary" size="lg">
                Schedule Demo
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default DriveEnterpriseShowcase;
