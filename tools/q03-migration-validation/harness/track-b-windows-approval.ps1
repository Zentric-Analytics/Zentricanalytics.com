$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
if (![Environment]::UserInteractive -or ![Console]::IsInputRedirected -or ![Console]::IsOutputRedirected -or $env:CI) { exit 26 }
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
public static class ZentricApprovalInput {
    [StructLayout(LayoutKind.Sequential)] public struct Source { public uint Device; public uint Origin; }
    [DllImport("user32.dll")] static extern bool GetCurrentInputMessageSource(out Source source);
    [DllImport("kernel32.dll")] public static extern uint WTSGetActiveConsoleSessionId();
    [DllImport("user32.dll")] static extern IntPtr OpenInputDesktop(uint flags, bool inherit, uint access);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern bool GetUserObjectInformation(
        IntPtr handle, int index, StringBuilder data, int length, out int needed);
    [DllImport("user32.dll")] static extern bool CloseDesktop(IntPtr handle);
    public static volatile bool Disconnected;
    public static void WatchController() {
        Thread thread = new Thread(() => {
            try { Console.In.ReadLine(); } catch { }
            finally { Disconnected = true; }
        });
        thread.IsBackground = true;
        thread.Start();
    }
    public static bool DefaultDesktop() {
        IntPtr desktop = OpenInputDesktop(0, false, 1);
        if (desktop == IntPtr.Zero) return false;
        try {
            StringBuilder name = new StringBuilder(256);
            int needed;
            return GetUserObjectInformation(desktop, 2, name, name.Capacity * 2, out needed)
                && name.ToString() == "Default";
        } finally { CloseDesktop(desktop); }
    }
    public static bool PhysicalInput(bool keyboard) {
        Source source;
        return GetCurrentInputMessageSource(out source) && source.Origin == 1
            && (keyboard ? source.Device == 1 : source.Device == 2 || source.Device == 4 || source.Device == 8);
    }
}
'@
$session = [Diagnostics.Process]::GetCurrentProcess().SessionId
if ($session -eq 0 -or $session -ne [ZentricApprovalInput]::WTSGetActiveConsoleSessionId() -or ![ZentricApprovalInput]::DefaultDesktop()) { exit 26 }
$line = [Console]::In.ReadLine()
if (!$line -or $line.Length -gt 8192) { exit 26 }
$q = ConvertFrom-Json -InputObject $line
if ($q.version -ne 1 -or $q.mode -cne 'local-synthetic-operator' -or $q.target -cne 'q03_replacement_track_b' -or
    $q.baseline -cne 'q03_replacement_baseline' -or $q.operation -cne 'Q03_NATIVE_TRACK_B_66_PLUS_2_V1' -or
    $q.cluster -cnotmatch '^[0-9]{16,24}$' -or $q.runner -cnotmatch '^sha256:[a-f0-9]{64}$' -or
    $q.nonce -cnotmatch '^[a-f0-9]{48}$' -or ($q.preview -isnot [bool])) { exit 26 }
foreach ($value in @($q.binding, $q.run, $q.container, $q.source, $q.manifest)) {
    if ($value -cnotmatch '^[a-f0-9]{64}$') { exit 26 }
}
$remaining = [int64]$q.expiresAt - [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
if ($remaining -le 0 -or $remaining -gt 300000) { exit 25 }
$mutex = [Threading.Mutex]::new($false, 'Local\ZentricAnalytics-Q03-Track-B')
$locked = $false
try {
    try { $locked = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $locked = $true }
    if (!$locked) { exit 27 }
    # A second line or EOF is a controller disconnect, never a decision.
    [ZentricApprovalInput]::WatchController()
    [Windows.Forms.Application]::EnableVisualStyles()
    $form = [Windows.Forms.Form]::new()
    $form.Text = if ($q.preview) { 'Zentric Analytics | Track B preview' } else { 'Zentric Analytics | Approve local Track B' }
    $form.StartPosition = 'CenterScreen'
    $form.ClientSize = [Drawing.Size]::new(700, 460)
    $form.MinimumSize = [Drawing.Size]::new(650, 450)
    $form.AutoScaleMode = 'Dpi'
    $form.Font = [Drawing.Font]::new('Segoe UI', 10)

    $heading = [Windows.Forms.Label]::new()
    $heading.Text = 'Zentric Analytics — local synthetic testing'
    $heading.Font = [Drawing.Font]::new('Segoe UI', 17, [Drawing.FontStyle]::Bold)
    $heading.SetBounds(22, 16, 656, 42)
    $heading.Anchor = 'Top, Left, Right'
    $form.Controls.Add($heading)
    $summary = [Windows.Forms.TextBox]::new()
    $summary.Multiline = $true
    $summary.ReadOnly = $true
    $summary.ScrollBars = 'Vertical'
    $summary.AccessibleName = 'Exact Track B operation and identities'
    $summary.SetBounds(22, 65, 656, 315)
    $summary.Anchor = 'Top, Bottom, Left, Right'
    $summary.Text = @(
        'Create exactly one fictional-data database: ' + $q.target
        'The peer-only baseline remains unchanged: ' + $q.baseline
        'Then apply 66 + 2 migrations, seed fictional fixtures, and run SQL, concurrency and Prisma tests.'
        'Approve authorizes real writes only in this local synthetic test environment.'
        ''
        'PostgreSQL cluster: ' + $q.cluster
        'Container: ' + $q.container
        'Runner image: ' + $q.runner
        'Source fingerprint: ' + $q.source
        'Migration manifest: ' + $q.manifest
        'Single-use run: ' + $q.run
        'Evidence: private WSL journal and dedicated Docker evidence volume.'
    ) -join [Environment]::NewLine
    $form.Controls.Add($summary)
    $approve = [Windows.Forms.Button]::new()
    $approve.Text = '&Approve'
    $approve.AccessibleName = 'Approve creating and testing the local fictional Track B database'
    $approve.SetBounds(436, 405, 114, 36)
    $approve.Anchor = 'Bottom, Right'
    $approve.Enabled = !$q.preview
    $cancel = [Windows.Forms.Button]::new()
    $cancel.Text = '&Cancel'
    $cancel.SetBounds(564, 405, 114, 36)
    $cancel.Anchor = 'Bottom, Right'
    $cancel.DialogResult = [Windows.Forms.DialogResult]::Cancel
    $form.Controls.AddRange(@($approve, $cancel))
    $form.CancelButton = $cancel
    $form.Add_Shown({ $cancel.Select(); $form.Activate() })
    $approve.Add_MouseUp({
        param($sender, $event)
        if ($event.Button -eq [Windows.Forms.MouseButtons]::Left -and $approve.ClientRectangle.Contains($event.Location) -and
            !$q.preview -and [ZentricApprovalInput]::PhysicalInput($false) -and [ZentricApprovalInput]::DefaultDesktop()) {
            $form.DialogResult = [Windows.Forms.DialogResult]::OK
        }
    })
    $approve.Add_KeyUp({
        param($sender, $event)
        if ($event.KeyCode -in @([Windows.Forms.Keys]::Space, [Windows.Forms.Keys]::Enter) -and !$q.preview -and
            [ZentricApprovalInput]::PhysicalInput($true) -and [ZentricApprovalInput]::DefaultDesktop()) {
            $form.DialogResult = [Windows.Forms.DialogResult]::OK
        }
    })
    $timer = [Windows.Forms.Timer]::new()
    $timer.Interval = 250
    $timer.Add_Tick({
        if ([ZentricApprovalInput]::Disconnected -or [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -ge [int64]$q.expiresAt -or
            ![ZentricApprovalInput]::DefaultDesktop()) { $form.DialogResult = [Windows.Forms.DialogResult]::Abort }
    })
    $timer.Start()
    $result = $form.ShowDialog()
    $timer.Dispose()
    $form.Dispose()
    if ($result -eq [Windows.Forms.DialogResult]::Abort) { exit 25 }
    if ($result -ne [Windows.Forms.DialogResult]::OK -or $q.preview -or [ZentricApprovalInput]::Disconnected -or
        [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -ge [int64]$q.expiresAt) { exit 24 }
    [Console]::Out.WriteLine((@{
        version = 1; decision = 'approved'; nonce = $q.nonce; binding = $q.binding; run = $q.run; session = $session
    } | ConvertTo-Json -Compress))
} finally {
    if ($locked) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
