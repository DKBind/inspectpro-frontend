import { useFormContext } from 'react-hook-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PlanType } from '@/services/models/organisation';
import { Input } from '@/components/ui/input';

export function PlanSelector() {
  const { register, watch, setValue } = useFormContext();
  const selectedPlan = watch('planType');

  const plans = [
    {
      type: PlanType.FREE,
      name: 'Free',
      description: 'Perfect for exploring the platform features.',
      price: '$0/mo',
    },
    {
      type: PlanType.STARTER,
      name: 'Starter',
      description: 'Essential tools for small teams getting started.',
      price: '$49/mo',
    },
    {
      type: PlanType.PRO,
      name: 'Professional',
      description: 'Advanced features for growing organizations.',
      price: '$99/mo',
      recommended: true,
    },
    {
      type: PlanType.ENTERPRISE,
      name: 'Enterprise',
      description: 'Custom solutions and dedicated support for large-scale operations.',
      price: 'Custom',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => {
          const isSelected = selectedPlan === plan.type;
          return (
            <Card
              key={plan.type}
              className={`relative cursor-pointer transition-all hover:border-primary/50 ${
                isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-muted'
              }`}
              onClick={() => setValue('planType', plan.type, { shouldValidate: true })}
            >
              {plan.recommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                  Recommended
                </div>
              )}
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription className="min-h-[40px]">{plan.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{plan.price}</div>
                {/* Hidden input to register with react-hook-form */}
                <Input
                  type="radio"
                  value={plan.type}
                  className="hidden"
                  {...register('planType')}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
