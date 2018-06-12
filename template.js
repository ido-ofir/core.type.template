
module.exports = {
    name: 'core.type.template',
    dependencies: [
        'core.type.component',
        'core.import.react',
        'core.import.react-dom',
    ],
    extend: {
        template(name, props, ...children){
            var Template = this.templates[name];
            if(!Template){ return null; }
            var { React } = core.imports;
            return (
                <Template { ...props }>
                    { children }
                </Template>
            );
        },
        templates: {},
        Template(definition){
            if(Array.isArray(definition)){
                return definition.map(this.Template)
            }
            
            var source = this.type.toSource({
                id: definition.name,
                key: definition.name,
                type: 'template',
                description: definition.description || '',
              }, definition);
        
            return this.build(source, definition.done);
        }
    },
    init(definition, done){
        
        var core = this;

        var { React, PropTypes, ReactDom } = core.imports;

        function parse(item){
            if(core.isArray(item)) return item.map(parse);
            if(!core.isObject(item)) return item;
            let parsed = {};
            if(item['core.template.code']){
                return {
                    'core.template.getter': eval(`(
                        function (props, state){
                            return ${item['core.template.code']};
                        }
                    )`)
                };
            }
            if(item['core.template.function']){
                // console.log('eval', item['core.template.function']);
                return { 'core.template.function': eval(`(${ item['core.template.function'] })`) };
            }
            for(var key in item){
                parsed[key] = parse(item[key]);
            }
            return parsed;
        }

        var TemplateItem = core.createComponent('TemplateItem', {
            propTypes: {
                path: PropTypes.array,
                item: PropTypes.object,
                templateProps: PropTypes.object,
                onMount: PropTypes.func,
                onUnmount: PropTypes.func,
            },
            componentDidMount(){
                this.props.onMount(this.props.path, this);
            },
            componentWillUnmount(){
                this.props.onUnmount(this.props.path, this);
            },
            renderChild(child, i){
                let { onMount, onUnmount, template, path } = this.props;
                var templateProps = template.props;
                if(!core.isObject(child)){ return child; }
                if(child['core.template.children']){
                    return templateProps.children;
                }
                if(child['core.template.getter']){
                    return child['core.template.getter'](templateProps, template.state);
                }
                return (
                    <TemplateItem 
                        key={ i }
                        path={ path.concat([i]) }
                        item={ child }
                        template={ template }
                        onMount={ onMount }
                        onUnmount={ onUnmount }/>
                );
            },
            render(){
                let { item, template, path } = this.props;
                let {
                    type,
                    props = {},
                    children = []
                } = item;
    
                let Component = core.components[type] || type;
                let getter, newProps = {};
                for(var m in props){
                    if(props[m]['core.template.getter']){
                        newProps[m] = getter.call(template, template.props, template.state);
                    }
                    else if(props[m]['core.template.function']){
                        newProps[m] = props[m]['core.template.function'].bind(template);
                    }
                    else{
                        newProps[m] = props[m];
                    }
                }
                return (
                    <Component { ...newProps }>
                        {
                            children.map(this.renderChild) 
                        }
                    </Component>
                );
            }
        });

        

        core.Type({
            name: 'template.function',
            extends: 'object',
            defaultValue: {
                body: 'function(){}'
            },
            schema: [
                {
                    key: 'body',
                    type: 'string'
                }
            ],
            build(source, done){
                done({ 
                    'core.template.function': eval(`(${ source.body })`) 
                });
            }
        });

        core.Type({
            name: 'template.jsx',
            schema: [
                {
                    key: 'source',
                    type: 'string'
                },
                {
                    key: 'code',
                    type: 'string'
                }
            ],
            defaultValue: {
                type: 'core.web.dom.div',
                props: {}
            },
            build(source, done){
                done({
                    'core.template.getter': eval(`(
                        function (props, state){
                            return ${ source.code };
                        }
                    )`)
                });
            }
        });

        core.Type({
            name: 'template.children',
            extends: 'string',
            defaultValue: []
        });

        core.Type({
            name: 'template.element',
            schema: [
                {
                    key: 'type',
                    type: 'ref',
                    description: 'the type of the element',
                    defaultValue: 'core.web.dom.div',
                },{
                    key: 'props',
                    type: 'object',
                    description: 'the props supplied to the element',
                    defaultValue: {}
                },{
                    key: 'children',
                    type: 'array',
                    description: 'the children of this element',
                    defaultValue: []
                }
            ],
            defaultValue: {
                type: 'core.web.dom.div',
                props: {}
            },
            build(source, done){
                debugger;
                core.buildObject(source, function(a,b){
                    debugger;
                    done(a, b)
                });
                // this.buildObject(source, done);
            }
        });

        core.Type({
            name: 'template.body',
            extends: 'template.element',
            defaultValue: {
                type: 'div',
                props: {},
                children: []
            },
            update(update){
                var { target, parents } = update;
                var parent = parents[0];
                core.build(target, (body) => {
                    var updateEvent = `core.template.update.${parent.value.name}`;
                    var template = core.types.template.find(parent.id);
                    template.body = parse(body);
                    core.emit(updateEvent);
                });
            },
            build(source, done){
                this.buildObject(source, function(a,b){
                    done(a, b)
                });
            }
        });

        core.Type({
            name: 'template.text',
            extends: 'text',
            // build(source, done){
            //     done(source.value);
            // }
        });

        

        core.Type({
            name: 'template',
            identifier: 'name',
            schema: [{
                key: 'name',
                type: 'string',
                isRequired: true
            },{
                key: 'description',
                type: 'text',
                description: 'describes this template',
                defaultValue: 'No description'
            },{
                key: 'dependencies',
                type: 'array',
            },{
                key: 'body',
                type: 'template.body',
            },{
                key: 'propTypes',
                type: 'array',
            }],
            update(update){
                var { internalPath, sourceElement, target } = update;
                if(internalPath.length){
                    var key = internalPath[0];
                    if(key === 'body'){
                        core.build(sourceElement, (body) => {
                            var updateEvent = `core.template.update.${target.name}`;                            
                            core.types.template.find(target.name).body = parse(body);
                            core.emit(updateEvent);
                        })
                    }
                }
            },
            build(source, done){

                var core = this;
                
                core.buildObject(source, (def)=>{
                    var { name, propTypes, body, dependencies } = def;
                    
                    var hoverEvent = `core.template.hover.${name}`;
                    var updateEvent = `core.template.update.${name}`;
                    core.Component({
                        name,
                        propTypes,
                        dependencies,
                        get(){
                            return {
                                getInitialState(){
                                    this.elements = {};
                                    return {
                                        useAnimations: true
                                    };
                                },                 
                                componentDidMount(){

                                    window.template = this;

                                    core.on(hoverEvent, this.onHover);
                                    core.on(updateEvent, this.onUpdate);

                                    this.root = ReactDom.findDOMNode(this);
                                    this.isHovering = false;
                                    this.hoveredElement = null;
                                    this.mask = document.createElement('div');
                                    this.mask.style.position = 'absolute';
                                    this.mask.style.background = 'rgba(70,70,250, 0.6)';
                                    
                                    this.display = document.createElement('div');
                                    this.display.style.background = '#ff8';
                                    this.display.style.padding = '1px 4px';
                                    this.display.style.border = '1px solid #aaa';
                                    this.display.style.borderRadius = '2px';
                                    this.display.style.position = 'absolute';
                                    this.display.style.fontSize = '10px';
                                    this.display.style.fontFamily = 'monospace';
                                    if(this.state.useAnimations){
                                        this.display.style.WebkitTransition = '0.2s ease';
                                        this.display.style.transition = '0.2s ease';
                                        this.mask.style.WebkitTransition = '0.2s ease';
                                        this.mask.style.transition = '0.2s ease';
                                    }
                                    
                                    if(!this.root.style.position){
                                        this.root.style.position = 'relative';
                                    }
                                    
                                },
                                componentWillUnmount(){
                                    core.off(hoverEvent, this.onHover);
                                },
                                add(path, element){
                                    var id = path.join('.');
                                    this.elements[id] = element;
                                },
                                remove(path, element){
                                    delete this.elements[id];
                                },
                                getTop(element, top){
                                    if(!top) { top = 0; }
                                    if((element === this.root) || !element){ return top; }
                                    top += element.offsetTop;
                                    return this.getTop(element.parentElement, top);
                                },
                                getLeft(element, left){
                                    if(!left) { left = 0; }
                                    if((element === this.root) || !element){ return left; }
                                    left += element.offsetLeft;
                                    return this.getLeft(element.parentElement, left);
                                },
                                onHover(path){
                                    var node;
                                    if(!path.length){
                                        if(this.isHovering){
                                            this.root.removeChild(this.mask);
                                            this.root.removeChild(this.display);
                                            this.isHovering = false;
                                        }
                                    }
                                    else{
                                        var id = path.join('.');
                                        var element = this.elements[id];
                                        if(!element){
                                            return console.log('no element');
                                        }
                                        var domNode = ReactDom.findDOMNode(element);
                                        var computedStyle = window.getComputedStyle(domNode);
                                        var top = this.getTop(domNode);
                                        var left = this.getLeft(domNode);
                                        var width = computedStyle.width.replace('px', '');
                                        var height = computedStyle.height.replace('px', '');
                                        this.mask.style.top = top + 'px';
                                        this.mask.style.left = left + 'px';
                                        this.mask.style.width = width + 'px';
                                        this.mask.style.height = height + 'px';
                                        this.display.style.top = (top + Number(height)) + 'px';
                                        this.display.style.left = left + 'px';
                                        this.display.innerHTML = `${element.props.item.type} ${width} x ${height}`;
                                        if(!this.isHovering){
                                            this.isHovering = true;
                                            this.root.appendChild(this.mask);
                                            this.root.appendChild(this.display);
                                        }
                                        this.hoveredElement = element;
                                    }
                                },
                                onUpdate(value){
                                    this.forceUpdate();
                                },
                                render(){
                                    var instance = core.types.template.find(name);
                                    return (
                                        <TemplateItem 
                                            path={ [0] }
                                            item={ instance.body }
                                            template={ this }
                                            onMount={ this.add }
                                            onUnmount={ this.remove }/>
                                    )
                                }
                            };
                        },
                        done(template){
                            core.templates[name] = template;
                            done(template, ()=>{
                                // after the instance have bee created
                                var parsed = parse(body);
                                core.types.template.find(name).body = parsed;
                            });
                        }
                    });
                });
                
            }
        });

        let plugin = {
            parse: parse,
            update(){
                
            }
        };

        done(plugin);
    }
};