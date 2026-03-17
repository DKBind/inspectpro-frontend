import { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Label } from '@/components/shared-ui/Label/label';
import { Input } from '@/components/shared-ui/Input/input';
import { ChevronDown, Calendar } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/shared-ui/DropdownMenu/dropdown-menu';
import { subscriptionService } from '@/services/subscriptionService';
import type { SubscriptionResponse } from '@/services/models/subscription';

export function PlanSelector() {
  const { watch, setValue, register, formState: { errors } } = useFormContext();
  const selectedPlanId = watch('subscriptionId');
  const subscriptionStartDate = watch('subscriptionStartDate');

  const [plans, setPlans] = useState<SubscriptionResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    subscriptionService.listActiveSubscriptions()
      .then(setPlans)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  const computedEndDate = (() => {
    if (!subscriptionStartDate || !selectedPlan?.durationMonths) return '';
    const d = new Date(subscriptionStartDate);
    if (isNaN(d.getTime())) return '';
    d.setMonth(d.getMonth() + selectedPlan.durationMonths);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  })();

  return (
    <div className="space-y-4">
      {/* Plan selector */}
      <div className="space-y-2">
        <Label className="text-slate-200">Subscription Plan <span className="text-destructive">*</span></Label>
        <DropdownMenu>
          <DropdownMenuTrigger
            className={`w-full inline-flex items-center justify-between h-11 rounded-md border bg-[#0f172a] px-3 text-sm font-normal text-white hover:bg-slate-900 focus:outline-none ${
              errors.subscriptionId ? 'border-destructive' : 'border-slate-500'
            }`}
            disabled={loading}
          >
            <span className={selectedPlan ? 'text-white' : 'text-slate-400'}>
              {loading ? 'Loading plans...' : selectedPlan ? selectedPlan.planName : 'Select a subscription plan'}
            </span>
            <ChevronDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-[280px] !bg-[#1e293b] border-slate-700 text-white z-[9999]">
            {plans.length === 0 ? (
              <DropdownMenuItem disabled className="text-slate-400">No active plans available</DropdownMenuItem>
            ) : (
              plans.map((plan) => (
                <DropdownMenuItem
                  key={plan.id}
                  onSelect={() => setValue('subscriptionId', plan.id, { shouldValidate: true })}
                  className="cursor-pointer focus:bg-slate-800 focus:text-white py-3"
                >
                  <span className="font-medium">{plan.planName}</span>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        {errors.subscriptionId && (
          <p className="text-sm text-destructive">{errors.subscriptionId.message as string}</p>
        )}
      </div>

      {/* Start Date */}
      <div className="space-y-2">
        <Label className="text-slate-200">
          Start Date <span className="text-destructive">*</span>
        </Label>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            type="date"
            {...register('subscriptionStartDate')}
            className={`pl-9 h-11 !bg-[#0f172a] text-white [color-scheme:dark] ${
              errors.subscriptionStartDate ? 'border-destructive' : 'border-slate-500'
            }`}
          />
        </div>
        {errors.subscriptionStartDate && (
          <p className="text-sm text-destructive">{errors.subscriptionStartDate.message as string}</p>
        )}
      </div>

      {/* End Date — read-only, auto-calculated */}
      <div className="space-y-2">
        <Label className="text-slate-200">End Date</Label>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <div className={`pl-9 h-11 bg-slate-950/30 border border-slate-700 rounded-md flex items-center text-sm ${computedEndDate ? 'text-slate-300' : 'text-slate-500'}`}>
            {computedEndDate || (selectedPlan?.durationMonths ? 'Select a start date' : 'Select a plan first')}
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Auto-calculated{selectedPlan?.durationMonths ? ` (${selectedPlan.durationMonths} months from start)` : ''}
        </p>
      </div>
    </div>
  );
}
