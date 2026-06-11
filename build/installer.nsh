; Runs inside .onInit — before any files are written.
; Kills a running Vecord instance so locked files can be overwritten.
!macro customInit
  nsExec::ExecToLog 'taskkill /IM "Vecord.exe" /T'
  Sleep 1500
  nsExec::ExecToLog 'taskkill /F /IM "Vecord.exe" /T'
  Sleep 500
!macroend

!macro customUnInit
  nsExec::ExecToLog 'taskkill /IM "Vecord.exe" /T'
  Sleep 1500
  nsExec::ExecToLog 'taskkill /F /IM "Vecord.exe" /T'
  Sleep 500
!macroend
