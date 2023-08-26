/*

TODO: optimize
- closure in Parser : 1526.3 ms
- isTerminal in Grammar : 1297.3 ms
- addState in ParseChart : 346.1 ms
- reduce in Parser : 248.3 ms
- equals in ParseState : 106.2 ms
- get lookahead in ParseState : 101.1 ms

*/




class Token{
	constructor(type, value, begin, end){
		this.type = type;
		this.value = value;
		this.stringBeginPos = begin;
		this.stringEndPos = end;
	}
	toString(){
		return this.type.length ? this.value.length ? `${this.type}<${this.value}>` : this.type : this.value
	}
}

/**
 * @typedef {{
 *     regex: RegExp,
 *     func: string=>any
 * }} TokenRule
 */
class Tokenizer{
	/**
     * @param {[string, TokenRule][]} tokenRules
	 * @param {string[]} [ignoredTokens]
     */
	constructor(tokenRules, ignoredTokens){
		this.tokenRules = tokenRules;
		this.ignoredTokens = new Set(ignoredTokens || []);
	}
	tokenize(input="") {
	    let tokens = [];
	    for (let i = 0; i < input.length;) {
			if(input.charAt(i).match(/\s/)){i++; continue;}
			let token = null;
			for (let [name, {regex, func}] of this.tokenRules) {
		        let result = input.slice(i).match(regex);
		        if (result !== null) {
		            let text = result[0];
					token = new Token(name, func(text), i, i + text.length);
		            i = i + text.length;
					break;
		        }
		    }
			if(!token){
				return [new Token("ERROR")];
			}
			
	        tokens.push(token);
	    }
	    return tokens.filter(i=>!this.ignoredTokens.has(i.type));
	}
}


class ParseRule{
	/**
	 * @param {string} lhs
	 * @param {string[]} tkns
	 */
	constructor(lhs, ...tkns){
		this.lhs = lhs;
		this.tkns = tkns || [];
		this.isEpsilon = !(tkns && tkns.length);
	}

	toString(){
		return `${this.lhs.padEnd(36)} -> ${
			this.isEpsilon ? 'ε' : this.tkns.join(' ')
		}`;
	}
}

class ParseState{
	/**
	 * @param {ParseRule} rule
	 * @param {number} from
	 * @param {number} pos
	 * @param {ParseState} prevState
	 * @param {"shift"|"reduce"|"closure"} ruleUsed
	 */
	constructor(rule, from, pos, prevState, ruleUsed){
		this.rule = rule;
		this.from = from;
		this.pos = pos;
        this.prevState = prevState;
		this.ruleUsed = ruleUsed;
	}

	get lhs(){return this.rule.lhs}
	get tkns(){return this.rule.tkns}

	get lookahead(){
		return this.tkns[this.pos];
	}
	get finished(){
		return this.pos >= this.tkns.length;
	}

	/**@param {ParseState} state */
	equals(state){
		return this.pos == state.pos && this.from == state.from && this.rule == state.rule;
	}

	toString(){
		return `${this.lhs.padEnd(36)} -> ${[
			...this.tkns.slice(0, this.pos), '•', ...this.tkns.slice(this.pos)
		].join(' ')} from ${this.from}`;
	}
}

class Grammar{
	/**
	 * @param {ParseRule[]} rules
	 */
	constructor(...rules){
		this.rules = rules;
		this.start = this.rules.filter(i => i.lhs == "__START__")[0];
        
        /** @type {Set<string>} */
        this.allTokens = new Set([].concat(...this.rules.map(i=>i.tkns.concat([i.lhs]))));
        /** @type {Set<string>} */
        this.nonTerminals = new Set(this.rules.map(i=>i.lhs));
        /** @type {Set<string>} */
        this.terminals = new Set(this.allTokens);
        for(let nonTerminal of this.nonTerminals) this.terminals.delete(nonTerminal);
	}
	/**
	 * @param {string} tkn
	 */
	isTerminal(tkn){
        return this.terminals.has(tkn);
	}
	toString(){
		return `Grammar{\n  ${this.rules.join("\n  ")}\n}\n`;
	}
}

class ParseChart{
	/**
	 * @param {Grammar} grammar
	 * @param {number} length
	 */
	constructor(grammar, length){
		this.grammar = grammar;
		/** @type {ParseState[][]} */
		this.chart = [
			[new ParseState(grammar.start, 0, 0, null)], 
			...new Array(length).fill().map(i=>[])
		];
	}
	addState(idx, state){
		for(const i of this.chart[idx]) if(i.equals(state)) return false;
		return this.chart[idx].push(state), true;
	}

	/** @param {number} idx */
	row(idx){
		return this.chart[idx]
	}

	toString(){
		let res = ""
        for(let i = 0; i < this.chart.length; i++){
            res += `== Row ${i} ==\n    ${this.chart[i].join("\n    ")}\n`
		}
        return res
	}
}


class ASTNode{
    /** @param {string} name @param {Token|ASTNode[]} value */
    constructor(name, value){
        this.name = name;
        this.value = value;
    }

	toString(){
		return JSON.stringify(this, null, 1)
			.replaceAll(/\{\n\s+"type": "[^\n]*",\n\s*"value": "([^\n]*)",\n\s*"stringBeginPos": \d+,\n\s*"stringEndPos": \d+\n\s*\}/g, "\"$1\"")
			.replaceAll(/"name": "(.*)",\n\s*"value":/g,"$1")
			.replaceAll(/\s*(\{|\},?)/g,"")
			.replaceAll(/(.+) "\1"/g,"\"$1\"")
			.replaceAll(/ ""/g, "");
	}
}


class Parser{
	/**
	 * @param {Grammar} grammar 
	 */
	constructor(grammar){
		this.grammar = grammar;

        /** @type {Map<string, Set<ParseRule>>} */
        this.closures = new Map();
        for(let token of this.grammar.allTokens){
            this.closures.set(token, this.grammar.rules.filter(i => i.lhs == token));
        }
	}
	/**
	 * @param {Token[]} tkns 
     * @returns {[ParseChart, ParseState]}
	 */
	parse(tkns){
		let chart = new ParseChart(this.grammar, tkns.length);

		for(let i = 0; i < tkns.length; i++){
			let changed = true;
			for(let j = 0; j < chart.row(i).length; j++){
				const prevState = chart.row(i)[j];
				if(prevState.finished){
					for(let state of this.reduce(chart, prevState)){
						chart.addState(i, state);
					}
				}
				else if(!this.grammar.isTerminal(prevState.lookahead)){
					for(let state of this.closure(i, prevState)){
						chart.addState(i, state);
					}
				}
			}
			for(let prevState of chart.row(i)){
				if(!prevState.finished && this.grammar.isTerminal(prevState.lookahead)){
					if(prevState.rule.isEpsilon || tkns[i].type == prevState.lookahead){
						chart.addState(i + 1, this.shift(prevState));
					}
				}
			}
		}

		let i = tkns.length;
		for(let j = 0; j < chart.row(i).length; j++){
			const prevState = chart.row(i)[j];
			if(prevState.finished){
				for(let state of this.reduce(chart, prevState)){
					chart.addState(i, state);
				}
			}
			else if(!this.grammar.isTerminal(prevState.lookahead)){
				for(let state of this.closure(i, prevState)){
					chart.addState(i, state);
				}
			}
		}

		for(let j = 0; j < chart.row(i).length; j++){
			const prevState = chart.row(i)[j];
			if(prevState.finished && prevState.lhs == "__START__"){
                return [chart, prevState];
            }
		}

		return [chart, null];
	}

    /** @param {Token[]} tokens */
    toAST(tokens){
		let tkns = tokens.map(i=>i);
		
        let [chart, last] = this.parse(tokens);
        if(!last) return null;
        let states = [last];
        while(last.prevState) states.unshift(last = last.prevState);
		
        let astStk = [];
		let stateStk = [];

		let prev = null;
        while(states.length){
            let state = states.shift();
            switch(state.ruleUsed){
				case "shift":
					let token = tkns.shift();
					astStk.push(new ASTNode(token.type, token));
					break;
				case "reduce":
					// if(prev.rule.tkns.length == 1) break;
					let t = [];
					for(let i = 0; i < prev.rule.tkns.length; i++)
						t.unshift(astStk.pop());
					if(t.length == 1 && Array.isArray(t[0].value) && t[0].value.length == 1){
						t[0] = t[0].value[0];
					}
					astStk.push(new ASTNode(prev.rule.lhs, t));
					break;
			}
			prev = state;
        }

		return astStk[0];
    }

	/**
	 * @param {number} from
	 * @param {ParseState} state
	 */
    closure(from, state){
        return this.closures.get(state.lookahead).map(i => new ParseState(i, from, 0, state, "closure"));
	}

	/**
	 * @param {ParseState} state 
	 */
    shift(state){
        return new ParseState(state.rule, state.from, state.pos + 1, state, "shift");
	}

	/**
	 * @param {ParseChart} chart 
	 * @param {ParseState} state 
	 */
    reduce(chart, state){
        return chart.row(state.from)
			.filter(rState => !rState.finished && rState.lookahead == state.lhs)
			.map(rState => new ParseState(rState.rule, rState.from, rState.pos + 1, state, "reduce"));
	}
}