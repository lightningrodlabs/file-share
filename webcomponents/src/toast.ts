
/** */
export function toastWarning(msg: string): void {
    createAlert("Warning", msg, "warning", "exclamation-triangle");
}


/** */
export function toastError(msg: string): void {
    createAlert("Error", msg, "danger", "exclamation-octagon");
}


/** Emit toast notifications */
export function createAlert(title: string, message: string, variant = 'primary', icon = 'info-circle', duration = 3000, extraHtml = "", id?: any) {
    const alert = Object.assign(document.createElement('sl-alert'), {
        id,
        variant,
        closable: true,
        duration,
        innerHTML: `
        <sl-icon name="${icon}" slot="icon"></sl-icon>
        <strong>${escapeHtml(title)}</strong><br />
        ${escapeHtml(message)}
        ${extraHtml}
      `
    });

    document.body.append(alert);
    return alert.toast();
}



/** */
export function escapeHtml(html: any) {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
}
