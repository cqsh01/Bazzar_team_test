import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useConfigStore } from '../../store/config-store';
import type { SimulateRequest } from '../../types/sim';
import { GlobalConfigForm } from './GlobalConfigForm';
import { UnitConfigForm } from './UnitConfigForm';
import { LoadoutManager } from './LoadoutManager';
import { SubmitSimulationButton } from './SubmitSimulationButton';
import { ValidationBanner } from '../ui/ValidationBanner';
import { PersistenceToolbar } from '../ui/PersistenceToolbar';

export function ConfigPanel() {
  const config = useConfigStore((s) => s.config);
  const replaceConfig = useConfigStore((s) => s.replaceConfig);
  const syncToLocalStorage = useConfigStore((s) => s.syncToLocalStorage);

  const form = useForm<SimulateRequest>({
    defaultValues: config,
    mode: 'onChange',
  });

  const skipSyncRef = React.useRef(false);

  const configItemLen = config.item_configs.length;
  const configSkillLen = config.skill_configs.length;
  const prevLensRef = React.useRef({ items: configItemLen, skills: configSkillLen });

  React.useEffect(() => {
    const prev = prevLensRef.current;
    if (prev.items !== configItemLen || prev.skills !== configSkillLen) {
      prevLensRef.current = { items: configItemLen, skills: configSkillLen };
      skipSyncRef.current = true;
      form.reset(config);
      skipSyncRef.current = false;
    }
  }, [config, configItemLen, configSkillLen, form]);

  React.useEffect(() => {
    const sub = form.watch((values) => {
      if (skipSyncRef.current) return;
      const full = values as SimulateRequest;
      if (full.unit_config && full.global_config) {
        replaceConfig(full);
      }
    });
    return () => sub.unsubscribe();
  }, [form, replaceConfig]);

  React.useEffect(() => {
    const onBeforeUnload = () => {
      syncToLocalStorage();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [syncToLocalStorage]);

  return (
    <FormProvider {...form}>
      <style>{`
        .animate-echo-highlight {
          animation: echo-highlight 2s ease-out;
          border-color: #0ea5e9 !important;
          box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.18);
        }
        @keyframes echo-highlight {
          0% { background-color: #e0f2fe; }
          100% { background-color: #ffffff; }
        }
      `}</style>
      <form onSubmit={(e) => e.preventDefault()} style={{ display: 'grid', gap: '1.25rem', position: 'relative' }}>
        <PersistenceToolbar />
        <ValidationBanner errors={form.formState.errors} />
        <GlobalConfigForm />
        <UnitConfigForm />
        <LoadoutManager />
        <SubmitSimulationButton />
      </form>
    </FormProvider>
  );
}
