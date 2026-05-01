import React, { useState, Children, useRef, useLayoutEffect, HTMLAttributes, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Variants } from 'framer-motion';

interface StepperProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  initialStep?: number;
  onStepChange?: (step: number) => void;
  onFinalStepCompleted?: () => void;
  stepCircleContainerClassName?: string;
  stepContainerClassName?: string;
  contentClassName?: string;
  footerClassName?: string;
  backButtonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  nextButtonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  backButtonText?: string;
  nextButtonText?: string;
  disableStepIndicators?: boolean;
  renderStepIndicator?: (props: {
    step: number;
    currentStep: number;
    onStepClick: (clicked: number) => void;
  }) => ReactNode;
}

export default function Stepper({
  children,
  initialStep = 1,
  onStepChange = () => {},
  onFinalStepCompleted = () => {},
  stepCircleContainerClassName = '',
  stepContainerClassName = '',
  contentClassName = '',
  footerClassName = '',
  backButtonProps = {},
  nextButtonProps = {},
  backButtonText = 'Back',
  nextButtonText = 'Continue',
  disableStepIndicators = false,
  renderStepIndicator,
  ...rest
}: StepperProps) {
  const [currentStep, setCurrentStep] = useState<number>(initialStep);
  const [direction, setDirection] = useState<number>(0);
  const stepsArray = Children.toArray(children);
  const totalSteps = stepsArray.length;
  const isCompleted = currentStep > totalSteps;
  const isLastStep = currentStep === totalSteps;

  const updateStep = (newStep: number) => {
    setCurrentStep(newStep);
    if (newStep > totalSteps) {
      onFinalStepCompleted();
    } else {
      onStepChange(newStep);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setDirection(-1);
      updateStep(currentStep - 1);
    }
  };

  const handleNext = () => {
    if (!isLastStep) {
      setDirection(1);
      updateStep(currentStep + 1);
    }
  };

  const handleComplete = () => {
    setDirection(1);
    updateStep(totalSteps + 1);
  };

  return (
    <div
      className="flex w-full flex-col items-center justify-center"
      {...rest}
    >
      <div
        className={`w-full rounded-2xl ${stepCircleContainerClassName}`}
        style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)' }}
      >
        {/* Step indicators */}
        <div className={`${stepContainerClassName} flex w-full items-center px-8 pt-8 pb-4`}>
          {stepsArray.map((_, index) => {
            const stepNumber = index + 1;
            const isNotLastStep = index < totalSteps - 1;
            return (
              <React.Fragment key={stepNumber}>
                {renderStepIndicator ? (
                  renderStepIndicator({
                    step: stepNumber,
                    currentStep,
                    onStepClick: clicked => {
                      setDirection(clicked > currentStep ? 1 : -1);
                      updateStep(clicked);
                    }
                  })
                ) : (
                  <StepIndicator
                    step={stepNumber}
                    disableStepIndicators={disableStepIndicators}
                    currentStep={currentStep}
                    onClickStep={clicked => {
                      setDirection(clicked > currentStep ? 1 : -1);
                      updateStep(clicked);
                    }}
                  />
                )}
                {isNotLastStep && <StepConnector isComplete={currentStep > stepNumber} />}
              </React.Fragment>
            );
          })}
        </div>

        {/* Step content */}
        <StepContentWrapper
          isCompleted={isCompleted}
          currentStep={currentStep}
          direction={direction}
          className={`px-8 ${contentClassName}`}
        >
          {stepsArray[currentStep - 1]}
        </StepContentWrapper>

        {/* Completed state */}
        {isCompleted && (
          <div className="px-8 pb-8 pt-4 text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
                <svg className="h-7 w-7 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-white/60 text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                Ready to get started
              </p>
              <a
                href="/register"
                className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-[14px] font-semibold bg-white text-neutral-900 hover:bg-neutral-100 transition-colors duration-200"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                Create Your Account
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
                </svg>
              </a>
            </motion.div>
          </div>
        )}

        {/* Footer navigation */}
        {!isCompleted && (
          <div className={`px-8 pb-8 ${footerClassName}`}>
            <div className={`mt-6 flex ${currentStep !== 1 ? 'justify-between' : 'justify-end'}`}>
              {currentStep !== 1 && (
                <button
                  onClick={handleBack}
                  className="rounded-lg px-4 py-2 text-sm transition-colors duration-200 text-white/30 hover:text-white/70"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                  {...backButtonProps}
                >
                  {backButtonText}
                </button>
              )}
              <button
                onClick={isLastStep ? handleComplete : handleNext}
                className="flex items-center gap-2 rounded-xl bg-white px-5 py-2 text-sm font-semibold text-neutral-900 transition-colors duration-200 hover:bg-neutral-100 active:bg-neutral-200"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
                {...nextButtonProps}
              >
                {isLastStep ? 'Finish' : nextButtonText}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Internal sub-components ───────────────────────────────────────────────────

interface StepContentWrapperProps {
  isCompleted: boolean;
  currentStep: number;
  direction: number;
  children: ReactNode;
  className?: string;
}

function StepContentWrapper({ isCompleted, currentStep, direction, children, className = '' }: StepContentWrapperProps) {
  const [parentHeight, setParentHeight] = useState<number>(0);

  return (
    <motion.div
      style={{ position: 'relative', overflow: 'hidden' }}
      animate={{ height: isCompleted ? 0 : parentHeight }}
      transition={{ type: 'spring', duration: 0.4 }}
      className={className}
    >
      <AnimatePresence initial={false} mode="sync" custom={direction}>
        {!isCompleted && (
          <SlideTransition key={currentStep} direction={direction} onHeightReady={h => setParentHeight(h)}>
            {children}
          </SlideTransition>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface SlideTransitionProps {
  children: ReactNode;
  direction: number;
  onHeightReady: (height: number) => void;
}

function SlideTransition({ children, direction, onHeightReady }: SlideTransitionProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (containerRef.current) {
      onHeightReady(containerRef.current.offsetHeight);
    }
  }, [children, onHeightReady]);

  return (
    <motion.div
      ref={containerRef}
      custom={direction}
      variants={stepVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
      style={{ position: 'absolute', left: 0, right: 0, top: 0 }}
    >
      {children}
    </motion.div>
  );
}

const stepVariants: Variants = {
  enter: (dir: number) => ({ x: dir >= 0 ? '-100%' : '100%', opacity: 0 }),
  center: { x: '0%', opacity: 1 },
  exit: (dir: number) => ({ x: dir >= 0 ? '50%' : '-50%', opacity: 0 }),
};

export function Step({ children }: { children: ReactNode }) {
  return <div className="py-4">{children}</div>;
}

interface StepIndicatorProps {
  step: number;
  currentStep: number;
  onClickStep: (clicked: number) => void;
  disableStepIndicators?: boolean;
}

function StepIndicator({ step, currentStep, onClickStep, disableStepIndicators = false }: StepIndicatorProps) {
  const status = currentStep === step ? 'active' : currentStep < step ? 'inactive' : 'complete';

  return (
    <motion.div
      onClick={() => { if (step !== currentStep && !disableStepIndicators) onClickStep(step); }}
      className="relative cursor-pointer outline-none"
      animate={status}
      initial={false}
    >
      <motion.div
        variants={{
          inactive: { scale: 1, backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' },
          active:   { scale: 1, backgroundColor: 'rgba(255,255,255,0.15)', color: '#ffffff' },
          complete: { scale: 1, backgroundColor: 'rgba(255,255,255,0.12)', color: '#ffffff' },
        }}
        transition={{ duration: 0.25 }}
        className="flex h-8 w-8 items-center justify-center rounded-full font-semibold text-sm"
        style={{ border: status === 'active' ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.06)' }}
      >
        {status === 'complete' ? (
          <CheckIcon className="h-3.5 w-3.5 text-white/70" />
        ) : status === 'active' ? (
          <div className="h-2 w-2 rounded-full bg-white" />
        ) : (
          <span className="text-xs">{step}</span>
        )}
      </motion.div>
    </motion.div>
  );
}

function StepConnector({ isComplete }: { isComplete: boolean }) {
  return (
    <div className="relative mx-2 h-px flex-1 overflow-hidden rounded bg-white/[0.07]">
      <motion.div
        className="absolute left-0 top-0 h-full bg-white/30"
        initial={false}
        animate={{ width: isComplete ? '100%' : '0%' }}
        transition={{ duration: 0.4, ease: 'easeInOut' }}
      />
    </div>
  );
}

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <motion.path
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.05, type: 'tween', ease: 'easeOut', duration: 0.25 }}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}
