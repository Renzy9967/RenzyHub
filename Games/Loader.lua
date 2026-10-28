local PlaceIdData = {
  [117020342702668] = {
    GameName = "Foresters",
    LinkPath = "https://raw.githubusercontent.com/Renzy9967/RenzyHub/refs/heads/main/Games/Foresters/obf_KRR6P4HTa0XlKDcUgvV8M00Pb3448lu26VwD2HbX1VssTvplj8HULZ6BB88ik9u9.lua",
  },
}

PlaceId = game.PlaceId
CurrentData = PlaceIdData[PlaceId]
ScriptFunc = nil
StarterGui = game:GetService("StarterGui")

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
    Text = "This game is not supported.",
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
  ScriptFunc()
else
  warn(msg)
end
