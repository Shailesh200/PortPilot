param(
  [Parameter(Mandatory = $true)][ValidateSet('get', 'set', 'delete')][string]$Op,
  [Parameter(Mandatory = $true)][string]$Target
)

$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

[StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
public struct NativeCredential {
  public uint Flags;
  public uint Type;
  public string TargetName;
  public string Comment;
  public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
  public uint CredentialBlobSize;
  public IntPtr CredentialBlob;
  public uint Persist;
  public uint AttributeCount;
  public IntPtr Attributes;
  public string TargetAlias;
  public string UserName;
}

public static class NativeCred {
  [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool CredWrite(ref NativeCredential userCredential, uint flags);
  [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool CredRead(string target, uint type, int reservedFlag, out IntPtr credentialPtr);
  [DllImport("advapi32.dll", SetLastError = true)]
  public static extern bool CredFree(IntPtr cred);
  [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool CredDelete(string target, uint type, int flags);
}
"@

if ($Op -eq 'set') {
  $secret = [string]$env:PP_SECRET
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($secret)
  $cred = New-Object NativeCredential
  $cred.Type = 1
  $cred.Persist = 2
  $cred.TargetName = $Target
  $cred.UserName = 'PortPilot'
  $cred.CredentialBlobSize = [uint32]$bytes.Length
  $cred.CredentialBlob = [System.Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
  [System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $cred.CredentialBlob, $bytes.Length)
  try {
    if (-not [NativeCred]::CredWrite([ref]$cred, 0)) { exit 1 }
  } finally {
    [System.Runtime.InteropServices.Marshal]::FreeHGlobal($cred.CredentialBlob)
  }
  exit 0
}

if ($Op -eq 'get') {
  $ptr = [IntPtr]::Zero
  if (-not [NativeCred]::CredRead($Target, 1, 0, [ref]$ptr)) { exit 2 }
  try {
    $c = [System.Runtime.InteropServices.Marshal]::PtrToStructure($ptr, [type][NativeCredential])
    $n = [int]$c.CredentialBlobSize
    if ($n -le 0) { exit 0 }
    $bytes = New-Object byte[] $n
    [System.Runtime.InteropServices.Marshal]::Copy($c.CredentialBlob, $bytes, 0, $n)
    [Console]::Out.Write([System.Text.Encoding]::UTF8.GetString($bytes))
  } finally {
    [NativeCred]::CredFree($ptr)
  }
  exit 0
}

if ($Op -eq 'delete') {
  [void][NativeCred]::CredDelete($Target, 1, 0)
  exit 0
}
