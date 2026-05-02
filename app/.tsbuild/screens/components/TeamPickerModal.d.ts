export type TeamPickerModalProps = {
    slotId: string;
    /** All teams loaded once on mount via window.vcd.match.listTeams. */
    onConfirm: (teamId: string) => Promise<void> | void;
    onError?: (msg: string) => void;
};
export declare function TeamPickerModal(props: TeamPickerModalProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=TeamPickerModal.d.ts.map