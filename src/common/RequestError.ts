import { RequestDetails } from '@common/Requests';

export interface RequestErrorOptions {
	request?: RequestDetails | undefined;
	status?: number | undefined;
	text?: string | undefined;
	isCanceled?: boolean | undefined;
	extra?: Record<string, unknown> | undefined;
}

export class RequestError extends Error {
	request?: RequestDetails | undefined;
	status?: number | undefined;
	text?: string | undefined;
	isCanceled?: boolean | undefined;
	extra?: Record<string, unknown> | undefined;

	constructor(options: RequestErrorOptions) {
		super(JSON.stringify(options));

		this.request = options.request;
		this.status = options.status;
		this.text = options.text;
		this.isCanceled = options.isCanceled;
		this.extra = options.extra;
	}
}
