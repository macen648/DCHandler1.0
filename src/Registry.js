const { DCH_CMD_ERROR, DCH_LOAD_ERROR } = require('./utils/DCH_ERROR')
const prettyMilliseconds = require("pretty-ms")
const Discord = require('discord.js')
const path = require("path")
const Log = require('./utils/DCH_Log')
const fs = require("fs")




class Registry {
    constructor(client, commandPath, options = {}){
        
        this.client = client

        this.client.commands = new Discord.Collection()

        this.Log = new Log().options({debug: options.debug })

        this.options = options

        this.commandPath = commandPath

        this.eventPath = options.eventPath

        this.commandWarnings = 0

        this.eventWarnings = 0
    }   

    loadCommands(){
        var startTime = performance.now()

        this.Log.message(`Loading commands...`)
        const result = this.registerDirectory(this.commandPath, this.registerCommand)

        if(result.status === "empty") return this.Log.warn(`Commands folder is empty.\nNo commands loaded.`)
        
        this.Log.message(`Commands loaded in ${prettyMilliseconds(performance.now() - startTime)}\n`)
        if (this.commandWarnings != 0 && this.options.ignoreWarnings == false) this.Log.warn(`Loaded with ${this.commandWarnings} warnings!`)

        return result
    }

    registerCommand(file, _filePath, _this) {
        const filePath = path.join(require.main.path, _filePath, file)

        var command = require(filePath)

        try {

            if (Object.keys(command).length === 0){
                _this.commandWarnings++
                _this.Log.warn(`Command file '${file}' isn't correct (Missing Command Structure).\nSkipping.`, _this.options.debug)
                return 
            } 

            if (!command.name) Object.assign(command, { name: file.split('.')[0] })

            if(command.name.includes(" ")){
                command.name = command.name.replace(/ /g, "_")
                _this.commandWarnings++
                _this.Log.warn(`Command file '${file}' name containes spaces.\nConverted to '${command.name}'.`, _this.options.debug)
            } 

            if (_this.client.commands.some(cmds => cmds.name === command.name)) {
                _this.Log.custom('CMD', '#fff100', ` -> Command with the name ${command.name.toLowerCase()} already exists, Loaded anyways.`, _this.options.debug)
                _this.commandWarnings++
                return _this.client.commands.set(command.name.toLowerCase(), command)
            }

            _this.client.commands.set(command.name.toLowerCase(), command)
            _this.Log.custom('CMD', '#00FF00', ` -> Loaded command '${command.name.toLowerCase()}'`, _this.options.debug)

        } catch (error) {
            new DCH_LOAD_ERROR(`Command file '${file.split('.')[0]}' Had a error loading.\n${error}`)
        }

        delete require.cache[require.resolve(path.join(require.main.path, _filePath, file))]

        return command
    }

    loadEvents(){
        var startTime = performance.now()
        this.client.eventCount = 0

        this.Log.message(`Loading events...`)
        const result = this.registerDirectory(this.eventPath, this.registerEvent)

        if(result.status === "empty") return this.Log.warn(`Event folder is empty.\nNo commands loaded.`)

        else this.Log.message(`Events loaded in ${prettyMilliseconds(performance.now() - startTime)}`)
        if (this.eventWarnings != 0 && this.options.ignoreWarnings == false) this.Log.info(`With ${this.commandWarnings} warnings!`)

        return result
    }  
    
    registerEvent(file, _filePath, _this) {
        const filePath = path.join(require.main.path, _filePath, file)

        var event = require(filePath)

        try {
            _this.client.on(file.split('.')[0], event.bind(null, _this.client))
            _this.client.eventCount++
            _this.Log.custom('EVNT', '#00FF00', `-> Loaded event '${file.split('.')[0]}'`, _this.options.debug)

        } catch (error) {
            new DCH_LOAD_ERROR(`Event file '${file.split('.')[0]}' Had a error loading.\n${error}`)
        }

        delete require.cache[require.resolve(path.join(require.main.path, _this.eventPath, file))]

        return event
    }


    registerDirectory(path, registerFile) {

        function registerSubDirectorys(path, _this){
            const dirs = fs.readdirSync(path, { withFileTypes: true }).filter(item => item.isDirectory()).map(item => item.name)
            if (!dirs) return 

            for (const dir of dirs) {
                if (fs.readdirSync(`${path}/${dir}`) == ''){
                    _this.commandWarnings++
                    return _this.Log.warn(`Folder ${dir} is empty.`, _this.options.debug)
                } 
                registerSubDirectorys(`${path}/${dir}`, _this)
                fs.readdirSync(`${path}/${dir}`).filter(file => file.endsWith(".js")).forEach(file => {
                     registerFile(file, `${path}/${dir}`, _this)
                })
            }
            
        }

        if (fs.readdirSync(path) == '') return { status: "empty" }

        fs.readdirSync(`${path}`).filter(file => file.endsWith(".js")).forEach(file => { registerFile(file, `${path}`, this)})
        
        registerSubDirectorys(path, this)
        
        return { status: "success", commandWarnings: this.commandWarnings, eventWarnings: this.eventWarnings }
    }


}

module.exports = Registry