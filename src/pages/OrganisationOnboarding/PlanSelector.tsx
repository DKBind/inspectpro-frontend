import { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronDown, Calendar } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { subscriptionService } from '@/services/subscriptionService';
import type { SubscriptionResponse } from '@/services/models/subscription';

export function PlanSelector() {
  const { watch, setValue, register, formState: { errors } } = useFormContext();
  const selectedPlanId = watch('subscriptionId');
  const startDateVal = watch('subscriptionStartDate');

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
    if (!startDateVal || !selectedPlan?.durationMonths) return null;
    try {
      const d = new Date(startDateVal);
      d.setMonth(d.getMonth() + selectedPlan.durationMonths);
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return null;
    }
  })();

  return (
    <div className="space-y-4">
      {/* Plan selector */}
      <div className="space-y-2">
        <Label className="text-slate-200">Subscription Plan <span className="text-destructive">*</span></Label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              disabled={loading}
              className={`w-full justify-between font-normal h-11 !bg-[#0f172a] text-white ${
                errors.subscriptionId ? 'border-destructive' : 'border-slate-500'
              }`}
            >
              <span className={selectedPlan ? 'text-white' : 'text-slate-400'}>
                {loading ? 'Loading plans...' : selectedPlan ? selectedPlan.planName : 'Select a subscription plan'}
              </span>
              <ChevronDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-[280px] !bg-[#1e293b] border-slate-700 text-white z-[9999]">
            {plans.length === 0 ? (
              <DropdownMenuItem disabled className="text-slate-400">No active plans available</DropdownMenuItem>
            ) : (
              plans.map((plan) => (
                <DropdownMenuItem
                  key={plan.id}
                  onSelect={() => setValue('subscriptionId', plan.id, { shouldValidate: true })}
                  className="flex justify-between cursor-pointer focus:bg-slate-800 focus:text-white py-3"
                >
                  <span className="font-medium">{plan.planName}</span>
                  <span className="text-xs text-slate-400 ml-4">
                    {plan.price != null ? `₹${plan.price}` : ''}
                    {plan.durationMonths != null ? ` · ${plan.durationMonths}mo` : ''}
                  </span>
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

      {/* End Date (auto-calculated) */}
      {selectedPlan && startDateVal && (
        <div className="space-y-2">
          <Label className="text-slate-200">
            End Date <span className="text-xs text-slate-400 font-normal">(auto-calculated)</span>
          </Label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              readOnly
              value={computedEndDate ?? '—'}
              className="pl-9 h-11 !bg-[#1e293b] text-slate-300 border-slate-600 cursor-not-allowed"
            />
          </div>
          {selectedPlan.durationMonths && (
            <p className="text-xs text-slate-400">
              Based on {selectedPlan.durationMonths} month{selectedPlan.durationMonths !== 1 ? 's' : ''} plan duration
            </p>
          )}
        </div>
      )}
    </div>
  );
}
