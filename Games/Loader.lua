local PlaceIdData = {
  [117020342702668] = {
    GameName = "Foresters",
    SupportedExecutors = {
      delta = true,
      vortex = true,
      wave = true,
    },
    LinkPath = "https://raw.githubusercontent.com/Renzy9967/RenzyHub/refs/heads/main/Games/Foresters/obf_KRR6P4HTa0XlKDcUgvV8M00Pb3448lu26VwD2HbX1VssTvplj8HULZ6BB88ik9u9.lua",
  },
}

function GetExecutor()
  if typeof(identifyexecutor) == "function" then
    return identifyexecutor()
  elseif typeof(getexecutorname) == "function" then
    return identifyexecutor()
  else
    return "Unknown"
  end
end

PlaceId = game.PlaceId
CurrentData = PlaceIdData[PlaceId]
ScriptFunc = nil
StarterGui = game:GetService("StarterGui")
CurrentExecutor = GetExecutor()
MsgSupported = "Your executor is supported for this scripr."
MsgBarelySupported = "Your executor is missing some features and may not work."
MsgNotSupported = "Your executor is not supported for the script to work properly."

game.StarterGui:SetCore("SendNotification", {
    Title = "Renzy Hub Loader",
    Text = "Loading.. this takes a few seconds.",
    Duration = 3
})
task.wait(3)

if not CurrentData then 
  warn("This game is not supported") 
  game.StarterGui:SetCore("SendNotification", {
    Title = "Renzy Hub Loader",
    Text = "This game is not supported yet.",
    Duration = 3
  })
  return 
end

local success, msg = pcall(function()
  ScriptFunc = loadstring(game:HttpGet(tostring(CurrentData.LinkPath)))
end)

if success then
  game.StarterGui:SetCore("SendNotification", {
    Title = "Renzy Hub Loader",
    Text = "Game: " .. CurrentData.GameName .. " | Loading script",
    Duration = 3
  })

  local msg = ""
  local lowered = string.lower(CurrentExecutor)
  local isFound = CurrentData.SupportedExecutors[lowered]
  
  if isFound then
    msg = MsgSupported
  elseif not isFound then
    msg = MsgBarelySupported
  elseif lowered == "unknown" then
    msg = MsgNotSupported
  end

  game.StarterGui:SetCore("SendNotification", {
    Title = "Renzy Hub Loader",
    Text = "Executor: " .. CurrentExecutor .. " | " .. msg,
    Duration = 3
  })
  
  ScriptFunc()
else
  warn(msg)
end
