export class CancellationToken {
  private _cancelled = false;
  get cancelled(): boolean {
    return this._cancelled;
  }
  cancel(): void {
    this._cancelled = true;
  }
}
