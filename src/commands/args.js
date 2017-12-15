const langCheck = require("../core/lang.check");
const db = require("../core/db");
const fn = require("../core/helpers");

//
// Commands
//

const cmdHelp = require("./help");
const cmdList = require("./list");
const cmdStats = require("./stats");
const cmdSettings = require("./settings");
const cmdTranslateLast = require("./translate.last");
const cmdTranslateThis = require("./translate.this");
const cmdTranslateAuto = require("./translate.auto");
const cmdTranslateStop = require("./translate.stop");

// ---------------------------------------
// Extract a parameter's value with regex
// ---------------------------------------

const extractParam = function(key, str, def = null, allowArray = false)
{
   const rgx = new RegExp(`${key}\\s*((?:(?:\\S*\\s*,\\s*)+\\S*)|\\S*)`, "m");

   const match = rgx.exec(str);

   if (match)
   {
      if (match[1] === "" || match[1] === " ")
      {
         return def;
      }
      if (allowArray)
      {
         return fn.removeDupes(match[1].replace(/\s/igm, "").split(","));
      }
      return match[1];
   }
   return def;
};

// --------------------
// Extract number param
// --------------------

const extractNum = function(str)
{
   const rgx = new RegExp("(?:^\\s*(-?\\d+))|(?:[^,]\\s*(-?\\d+))", "im");

   const match = rgx.exec(str);

   if (match)
   {
      if (match[1])
      {
         return match[1];
      }
      return match[2];
   }
   return null;
};

// ------------------
// Check for content
// ------------------

const checkContent = function(msg, output)
{
   const hasContent = (/([^:]*):(.*)/).exec(msg);

   if (hasContent)
   {
      output.main = hasContent[1].trim();
      output.content = hasContent[2].trim();
   }
};

// ------------------
// Get main arg
// ------------------

const getMainArg = function(output)
{
   const sepIndex = output.main.indexOf(" ");

   if (sepIndex > -1)
   {
      output.params = output.main.slice(sepIndex + 1);
      output.main = output.main.slice(0, sepIndex);
   }
};

// --------------------------------------
// Analyze arguments from command string
// --------------------------------------

module.exports = function(data)
{
   var output = {
      main: data.message.content.replace(data.config.translateCmd, "").trim(),
      params: null
   };

   checkContent(output.main, output);

   getMainArg(output);

   if (output.main === "channel")
   {
      output.auto = output.main;
      output.main = "auto";
   }

   output.to = langCheck(extractParam("to", output.params, "default", true));

   output.from = langCheck(extractParam("from", output.params, "auto", true));

   output.for = extractParam("for", output.params, ["me"], true);

   output.num = extractNum(output.params);

   //
   // Get server/bot info/settings
   //

   var id = "bot";

   if (data.message.channel.type === "text")
   {
      id = data.message.channel.guild.id;
   }

   db.getServerInfo(id, function(err, server)
   {
      if (err)
      {
         console.error(err);
      }

      else
      {
         output.server = server;
      }

      //
      // Get default language of server/bot
      //

      if (output.to === "default")
      {
         if (server && server.lang)
         {
            output.to = langCheck(server.lang);
         }
         else
         {
            output.to = langCheck(data.config.defaultLanguage);
         }
      }

      //
      // Add command info to main data var
      //

      data.cmd = output;


      //
      // check if channel is writable
      //

      data.canWrite = true;

      if (data.message.channel.type === "text")
      {
         data.canWrite = fn.checkPerm(
            data.message.channel.guild.me,
            data.message.channel,
            "SEND_MESSAGES"
         );
      }

      //
      // log command data (dev)
      //

      //console.log(data.canWrite);
      //console.log(data.cmd);

      //
      // Legal Commands
      //

      const cmdMap =
      {
         "this": cmdTranslateThis,
         "last": cmdTranslateLast,
         "auto": cmdTranslateAuto,
         "stop": cmdTranslateStop,
         "help": cmdHelp,
         "list": cmdList,
         "stats": cmdStats,
         "settings": cmdSettings
      };

      //
      // Execute command if exists
      //

      if (cmdMap.hasOwnProperty(output.main))
      {
         cmdMap[output.main](data);
      }
   });
};
