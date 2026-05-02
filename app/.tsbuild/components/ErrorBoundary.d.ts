import { Component, type ErrorInfo, type ReactNode } from 'react';
type State = {
    hasError: boolean;
    errorMessage: string | null;
};
type Props = {
    children: ReactNode;
};
export declare class ErrorBoundary extends Component<Props, State> {
    state: State;
    static getDerivedStateFromError(err: Error): State;
    componentDidCatch(err: Error, info: ErrorInfo): void;
    handleReload: () => void;
    render(): ReactNode;
}
export {};
//# sourceMappingURL=ErrorBoundary.d.ts.map