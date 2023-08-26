var allowed_tokens = [
	["COMMENT", /^<!--.*?-->/s],
	...`
			< > / # =
		`.trim().split(/ |\n/g).map(i => i.trim()).map(i => [i, new RegExp(`^(${i.replace(/\||\+|\*|\(|\)|\[|]|\.|\?|\^/g, "\\$&")})`)]),

	//Tags
	...TAGS.map(i => [i.toUpperCase(), new RegExp(`^${i}\\b`, 'i')]),

	//Properties
	...PROPERTIES.map(i => [i.toUpperCase(), new RegExp(`^${i}\\b`, 'i')]),

	["STRING", /^"([^\\"\n]|\\.|\\")*"/],
	
	//Custom Identifiers
	["CUSTOM", /^([a-zA-Z\-:][a-zA-Z0-9\-:]*)\b/],
	
	["UNKNOWN", /^./]
];

var tokenizer = new Tokenizer(allowed_tokens.map(i => [i[0], { regex: i[1], func: s => s }]), []);

var grammar_s = `
__START__ := svgs

svgs := svg
svgs := svgs svg

svg := < SVG property-list > contents < / SVG >

contents := ε
contents := contents element

${
	TAGS.map(i=>i.toUpperCase()).map(i => `
 		element := < ${i} property-list > contents < / ${i} >
		element := < ${i}  property-list / >
  	`).join('')
}

element := < CUSTOM property-list > contents < / CUSTOM >
element := < CUSTOM property-list / >

element := COMMENT

property-list := ε
property-list := property-list property-decl

property-decl := property = STRING
property-decl := property

${PROPERTIES.map(i=>i.toUpperCase()).map(i => `
	property := ${i}
`).join('\n')}

property := CUSTOM
`;


var grammar = new Grammar(...grammar_s
	.trim()
	.split(/\s*\n+\s*/g)
	.filter(i => i.length && !i.match(/^\/\//))
	.map(i => i.split(':='))
	.map(
		i => new ParseRule(
			i[0].trim(),
			...(j => j[0] == 'ε' ? [] : j)(i[1].trim().split(/ +/g))
		)
	)
)

var parser = new Parser(grammar);


let input = document.getElementById("input");
let output = document.getElementById("highlighted");

{	//Testing
	/**@type {HTMLInputElement}*/

	input.onscroll = /**@param e*/ e => {
		output.scrollTop = input.scrollTop;
		output.scrollLeft = input.scrollLeft;
	}

	input.value = `
<svg width="100" height="100" viewbox="0 0 100 100">
	<circle cx="50" cy="50" r="40" stroke="black" stroke-width="4" fill="yellow" />
</svg>
	`.trim().replaceAll("\t", "    ");
	input.oninput = input.onchange = _ => {
		let tokens = tokenizer.tokenize(input.value);
		try {
			let ast = parser.toAST(tokens);
			document.getElementById("text-container").style.setProperty("background-color", "limegreen");
			highlight(ast, input.value, output);
			document.getElementById("output-container").innerHTML = input.value;
			for(let svg of document.getElementById("output-container").children){
				svg.setAttribute('xmlns', "http://www.w3.org/2000/svg");
				svg.style.setProperty("--w", svg.getAttribute("width") + "px");
				svg.style.setProperty("--h", svg.getAttribute("height") + "px");
				svg.style.setProperty("--aspect", svg.getAttribute("height") / svg.getAttribute("width"));
			}
		}
		catch {
			document.getElementById("text-container").style.setProperty("background-color", "red");
			output.innerHTML = input.value;
			highlightBasic(tokens, input.value, output);
		}
	}
	input.oninput();
	//input.onkeypress = 
	input.onkeydown = e => {
		if (e.code == "Backquote") {
			let tokens = tokenizer.tokenize(input.value);
			let ast = parser.toAST(tokens);

			console.log(ast.toString());

			e.preventDefault();
		}
		if (e.key == "/" && e.ctrlKey) {

			let { value, selectionStart, selectionEnd, selectionDirection } = input;
			value = "\n" + value + "\n";
			selectionStart++; selectionEnd++;
			let prevNewLinePos = value.substring(0, selectionStart).lastIndexOf("\n");
			if (prevNewLinePos == -1) prevNewLinePos = 0;
			let nextNewLinePos = value.substring(selectionEnd).indexOf("\n") + selectionEnd;
			if (nextNewLinePos == -1) nextNewLinePos = value.length;
			let changes = "";
			let lines = value.substring(prevNewLinePos, nextNewLinePos).split("\n").slice(1);

			if (lines.map(i => i.length == 0 || i.match(/^\s*\/\//) && true).reduce((a, b) => a && b, true)) {
				selectionStart -= lines[0].length ? lines[0].match(/(?<=^\s*)\/\/ ?/)[0].length : 0;
				selectionEnd -= lines.map(i => i.length ? i.match(/(?<=^\s*)\/\/ ?/)[0].length : 0).reduce((a, b) => a + b);
				changes = "\n" + lines.map(i => i.replace(/^(\s*)\/\/ ?/, "$1")).join("\n");
			}
			else {
				selectionStart += lines[0].length ? 3 : 0;
				selectionEnd += lines.map(i => i.length ? 3 : 0).reduce((a, b) => a + b);
				changes = "\n" + lines.map(i => i.replace(/^((    )*)(.)/, "$1// $3")).join("\n");
			}
			value = value.substring(0, prevNewLinePos) + changes + value.substring(nextNewLinePos);
			input.value = value.substring(1, value.length - 1);
			e.preventDefault();

			input.selectionStart = selectionStart - 1;
			input.selectionEnd = selectionEnd - 1;
			input.selectionDirection = selectionDirection;

			input.oninput();
		}
		if (e.code == "Tab") {
			let { value, selectionStart, selectionEnd, selectionDirection } = input;
			let prevNewLinePos = value.substring(0, selectionStart).lastIndexOf("\n");
			if (prevNewLinePos == -1) prevNewLinePos = 0;
			let nextNewLinePos = value.substring(selectionEnd).indexOf("\n") + selectionEnd;
			if (nextNewLinePos == -1) nextNewLinePos = value.length;
			let changes = "";
			if (selectionStart == selectionEnd) {
				let before = value.substring(prevNewLinePos, selectionEnd);
				let after = value.substring(selectionEnd, nextNewLinePos);
				if (e.shiftKey == false) {
					let padding_length = 4 - ((before.length + 3) % 4);
					changes = before + " ".repeat(padding_length) + after;
					selectionEnd += padding_length;
					selectionStart += padding_length;
				}
				else {
					let unpad_length = (before.match(/^\n {0,4}/)[0] || "\n").length - 1;
					changes = before.replace(/^\n {0,4}/, "\n") + after;
					selectionEnd -= unpad_length;
					selectionStart -= unpad_length;
				}
			}
			else {
				let lines = value.substring(prevNewLinePos, nextNewLinePos).split("\n").slice(1);
				if (e.shiftKey == false) {
					changes = "\n" + lines.map(i => "    " + i).join("\n");
					selectionStart += 4;
					selectionEnd += lines.length * 4;
				}
				else {
					selectionEnd -= lines.map(i => (i.match(/^ {0,4}/)[0] || []).length).reduce((a, b) => a + b);
					selectionStart -= (lines[0].match(/^ {0,4}/)[0] || []).length;
					changes = "\n" + lines.map(i => i.replace(/^ {0,4}/, "")).join("\n");
				}
			}
			input.value = value.substring(0, prevNewLinePos) + changes + value.substring(nextNewLinePos);
			e.preventDefault();

			input.selectionStart = selectionStart;
			input.selectionEnd = selectionEnd;
			input.selectionDirection = selectionDirection;

			input.oninput();
		}
	}
}

document.getElementById("save-svg-btn").onclick = _ => {
	for(let svg of document.getElementById("output-container").children){
		var str = new XMLSerializer().serializeToString(svg);
		const href = `data:image/svg+xml;base64,${btoa(str)}`;
		
	  	const a = document.createElement('a');
	  	a.setAttribute('download', 'file.svg');
	  	a.href = href;
	  	a.setAttribute('target', '_blank');
	  	a.click();
	}
}

document.getElementById("save-img-btn").onclick = _ => {
	for(let svg of document.getElementById("output-container").children){
		const img = document.createElement('img');
		const canvas = document.createElement('canvas');
		
		var str = new XMLSerializer().serializeToString(svg);
		const svgsrc = `data:image/svg+xml;base64,${btoa(str)}`;
		img.src = svgsrc;
		
		const w = canvas.width = svg.width.baseVal.value;
		const h = canvas.height = svg.height.baseVal.value;
		console.log(w, h);

		img.onload = _ => {
			canvas.getContext('2d').drawImage(img, 0, 0, w, h);
			const href = canvas.toDataURL('image/png');
	
			console.log(href);
			
		  	const a = document.createElement('a');
		  	a.setAttribute('download', 'file.png');
		  	a.href = href;
		  	a.setAttribute('target', '_blank');
		  	a.click();
		}
	}
}