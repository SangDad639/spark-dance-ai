import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ApiKeys, GenerationJob } from '@/types';

interface AppContextType {
  apiKeys: ApiKeys | null;
  setApiKeys: (keys: ApiKeys) => void;
  currentJob: GenerationJob | null;
  setCurrentJob: (job: GenerationJob | null) => void;
  jobHistory: GenerationJob[];
  addJobToHistory: (job: GenerationJob) => void;
  removeJobFromHistory: (jobId: string) => void;
  clearHistory: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [apiKeys, setApiKeysState] = useState<ApiKeys | null>(null);
  const [currentJob, setCurrentJob] = useState<GenerationJob | null>(null);
  const [jobHistory, setJobHistory] = useState<GenerationJob[]>([]);

  useEffect(() => {
    const savedKeys = localStorage.getItem('apiKeys');
    if (savedKeys) {
      setApiKeysState(JSON.parse(savedKeys));
    }

    const savedHistory = localStorage.getItem('jobHistory');
    if (savedHistory) {
      setJobHistory(JSON.parse(savedHistory));
    }
  }, []);

  const setApiKeys = (keys: ApiKeys) => {
    setApiKeysState(keys);
    localStorage.setItem('apiKeys', JSON.stringify(keys));
  };

  const addJobToHistory = (job: GenerationJob) => {
    const updatedHistory = [job, ...jobHistory];
    setJobHistory(updatedHistory);
    localStorage.setItem('jobHistory', JSON.stringify(updatedHistory));
  };

  const removeJobFromHistory = (jobId: string) => {
    const updatedHistory = jobHistory.filter(job => job.id !== jobId);
    setJobHistory(updatedHistory);
    localStorage.setItem('jobHistory', JSON.stringify(updatedHistory));
  };

  const clearHistory = () => {
    setJobHistory([]);
    localStorage.removeItem('jobHistory');
  };

  return (
    <AppContext.Provider
      value={{
        apiKeys,
        setApiKeys,
        currentJob,
        setCurrentJob,
        jobHistory,
        addJobToHistory,
        removeJobFromHistory,
        clearHistory,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
