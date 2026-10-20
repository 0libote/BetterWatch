import { Shared } from '@common/Shared';
import { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps extends WithChildren {}

interface ErrorBoundaryState {
	hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = {
			hasError: false,
		};
	}

	componentDidCatch(error: Error, info: ErrorInfo): void {
		Shared.errors.log(error, info);
		this.setState({
			hasError: true,
		});
	}

	render(): ReactNode {
		return this.state.hasError ? <div className="startup" role="alert"><h1>Something interrupted BetterWatch.</h1><p>Your saved preferences are still in this browser. Reload the workspace to try again.</p><button className="button primary" onClick={() => window.location.reload()}>Reload workspace</button></div> : this.props.children;
	}
}
