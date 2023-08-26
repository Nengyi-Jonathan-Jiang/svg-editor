/** @param {ASTNode} ast @returns {Token[]} */
function getTokens(ast){
    if(Array.isArray(ast.value)){
        return [].concat(...ast.value.map(getTokens));
    }
    return [ast.value];
}

/** @param {ASTNode} ast @param {string} originaltext @param {HTMLDivElement} targetDiv */
function highlight(ast, originaltext, targetDiv){
    let tokens = getTokens(ast);
    /** @type {Map<Token,string>} */
    let m = basicMap(tokens);
    let stateStack = [];

    (/**@param {ASTNode} node*/function traverse(node){
        switch(node.name){
            // case "function_decl":
                
            //     break;
            default:
                if(Array.isArray(node.value)) node.value.forEach(traverse);
        }
    })(ast);

    // console.log(m);

    let res = originaltext;

    for(let tk of [...tokens].reverse()){
        let {stringBeginPos, stringEndPos} = tk;
        res = res.substring(0, stringBeginPos) + "\0span class=\"" + (m.get(tk) || "unknown") + "\"\1" + res.substring(stringBeginPos, stringEndPos) + "\0/span\1" + res.substring(stringEndPos);
    }

    targetDiv.innerHTML = res.replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll("\0","<").replaceAll("\1",">");	
}

/** @param {Token[]} tokens */
function basicMap(tokens){
    /** @type {Map<Token,string>} */
    let m = new Map();
    for(let token of tokens){
        switch(token.type){
            case "STRING":
                m.set(token, "string-literal");
                break;
			
            case "<": case ">": case "=": case "/": case "COMMENT":
                m.set(token, "operator");
                break;

			case "CUSTOM":
                m.set(token, "unknown");
            default:
				if(TAGS.map(i => i.toUpperCase()).indexOf(token.type) != -1)
                	m.set(token, "control-keyword");
				else if(PROPERTIES.map(i => i.toUpperCase()).indexOf(token.type) != -1)
                	m.set(token, "keyword");
				else m.set(token, "unknown");
        }
    }
    return m;
}

/** @param {Token[]} tokens @param {string} originaltext @param {HTMLDivElement} targetDiv */
function highlightBasic(tokens, originaltext, targetDiv){
    let m = basicMap(tokens);
    let res = originaltext;

    for(let tk of [...tokens].reverse()){
        let {stringBeginPos, stringEndPos} = tk;
        res = res.substring(0, stringBeginPos) + "\0span class=\"" + (m.get(tk) || "unknown") + "\"\1" + res.substring(stringBeginPos, stringEndPos) + "\0span\1" + res.substring(stringEndPos);
    }

    targetDiv.innerHTML = res.replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll("\0","<").replaceAll("\1",">");
}