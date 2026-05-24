import { createContext, useContext, useState } from "react";

interface QuizGuardContextValue {
  isQuizActive: boolean;
  setQuizActive: (active: boolean) => void;
}

const QuizGuardContext = createContext<QuizGuardContextValue>({
  isQuizActive: false,
  setQuizActive: () => {},
});

export function QuizGuardProvider({ children }: { children: React.ReactNode }) {
  const [isQuizActive, setQuizActive] = useState(false);
  return (
    <QuizGuardContext.Provider value={{ isQuizActive, setQuizActive }}>
      {children}
    </QuizGuardContext.Provider>
  );
}

export function useQuizGuard() {
  return useContext(QuizGuardContext);
}
