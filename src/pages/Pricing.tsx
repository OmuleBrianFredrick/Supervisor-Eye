import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';

export default function Pricing() {
  const plans = [
    {
      name: 'Starter',
      price: '$49',
      period: '/month',
      description: 'Perfect for small teams getting started with workspace monitoring.',
      features: [
        'Up to 10 users',
        'Basic reporting',
        'Standard AI insights',
        'Email support',
        '30-day data retention',
      ],
      missingFeatures: [
        'Advanced AI analysis',
        'Custom webhooks',
        'Dedicated account manager',
      ],
      buttonText: 'Get Started',
      buttonVariant: 'secondary',
    },
    {
      name: 'Professional',
      price: '$149',
      period: '/month',
      description: 'Ideal for growing organizations needing advanced insights.',
      features: [
        'Up to 50 users',
        'Advanced reporting & analytics',
        'Premium AI model access',
        'Priority support',
        'Unlimited data retention',
        'Custom webhooks',
      ],
      missingFeatures: [
        'Dedicated account manager',
      ],
      buttonText: 'Start Free Trial',
      buttonVariant: 'primary',
      popular: true,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      description: 'For large enterprises requiring full control and dedicated support.',
      features: [
        'Unlimited users',
        'Custom reporting dashboards',
        'Custom AI model training',
        '24/7 phone & email support',
        'Dedicated account manager',
        'On-premise deployment options',
      ],
      missingFeatures: [],
      buttonText: 'Contact Sales',
      buttonVariant: 'secondary',
      link: '/contact'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-20 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white mb-6">
            Simple, Transparent Pricing
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Choose the plan that best fits your organization's needs. Upgrade or downgrade at any time.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto pt-8">
          {plans.map((plan) => (
            <div 
              key={plan.name} 
              className={`relative bg-white dark:bg-slate-900 rounded-3xl shadow-xl flex flex-col border ${
                plan.popular ? 'border-indigo-500 shadow-indigo-500/10 md:scale-105 z-10' : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              {plan.popular && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                  <span className="bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider py-1 px-3 rounded-full shadow-md">
                    Most Popular
                  </span>
                </div>
              )}
              
              <div className="p-8 pb-0">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{plan.name}</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm h-12">{plan.description}</p>
                <div className="mt-6 flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-slate-900 dark:text-white">{plan.price}</span>
                  <span className="text-slate-500 font-medium">{plan.period}</span>
                </div>
              </div>

              <div className="p-8 flex-1 flex flex-col">
                <ul className="space-y-4 mb-8 flex-1">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                      <span className="text-slate-700 dark:text-slate-300 text-sm">{feature}</span>
                    </li>
                  ))}
                  {plan.missingFeatures.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 opacity-50">
                      <XCircle className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="text-slate-500 text-sm line-through">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Link 
                  to={plan.link || '/register'}
                  className={`w-full py-4 rounded-xl font-bold text-center transition-all ${
                    plan.buttonVariant === 'primary'
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-500/30'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {plan.buttonText}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
