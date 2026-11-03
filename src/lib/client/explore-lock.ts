type LockRequest = () => void;

let requestLock: LockRequest | null = null;

export function setExploreLockRequest(request: LockRequest | null): void {
  requestLock = request;
}

export function requestExplorePointerLock(): void {
  requestLock?.();
}
