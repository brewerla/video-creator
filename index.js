const fs = require('fs');
const {exec, execSync, spawnSync} = require('child_process');
const {join, resolve} = require("node:path");
const fontkit = require('fontkit');

let argv = require('minimist')(process.argv.slice(2));


console.log(argv);

console.log(process.cwd());

if(!argv.m || !argv.v) {
	console.log('arguments are incomplete');
	console.log('-m and -v flags are required');
	return;
}

//CUSTOMIZATION VARIABLES
const VARIATION_COUNT = 20;

//Fisher-Yates shuffle algorithm
function shuffle(arr) {
	let j, temp;
	for(let i = arr.length - 1; i > 0; i--) {
		j = Math.floor(Math.random()* (i + 1));
		temp = arr[j];
		arr[j] = arr[i];
		arr[i] = temp;
	}
}

let getRandomFilename = () => {
	let filename = '';
	for(let i = 0; i < 10; i++) {
		filename += Math.floor(Math.random() * 10);
	}

	return `${filename}.mp4`
}



//Main video path
const mainVideoDirectoryPath = join(process.cwd(), argv.v)
const musicDirectoryPath = join(process.cwd(), argv.m);
const fontFilesDirectoryPath = join(__dirname, 'fontsdir')

const mainVideos = fs.readdirSync(mainVideoDirectoryPath);
const musicFiles = fs.readdirSync(musicDirectoryPath);

const colorsFile = fs.readFileSync(join(__dirname, 'colors.txt'), 'utf-8');
let colors = colorsFile.split('\n');
//Change the colors to ass color format
for(let i = 0; i < colors.length; i++) {
	colors[i] = {
		hex: '#' + colors[i],
		ass: `&H${colors[i].toUpperCase().match(/.{1,2}/g).reverse().join('')}&`,
	};
}

console.log(colors);



try {
	//Grab and store all font names for use in the FFMPEG command.
	let fontNames = [];
	fs.readdirSync(fontFilesDirectoryPath).forEach((file) => {
		let font = fontkit.openSync(join(fontFilesDirectoryPath, file))
		fontNames.push(font.fullName);
	})

	const outputDirectoryPath = join(process.cwd(), 'output');

	//Create output folder
	if(!fs.existsSync(outputDirectoryPath)) {
		fs.mkdirSync(outputDirectoryPath);
	}

	let outputDirectories = fs.readdirSync(outputDirectoryPath, { withFileTypes: true })
		.filter(dirent => dirent.isDirectory())
		.map(dirent => dirent.name)


	let currentDirectoryNumber = parseInt(outputDirectories[outputDirectories.length - 1]) + 1;
	currentDirectoryNumber ||= 0;

	//MAKE ALL THE VARIATIONS FOR THE VIDEOS
	for(let i = 0; i < mainVideos.length; i++, currentDirectoryNumber++) {
		//Shuffle the music files and the font names.
		shuffle(musicFiles);
		shuffle(fontNames);

		let mainVideoPath = join(mainVideoDirectoryPath, mainVideos[i]);
		let currentOutputDirectoryPath = join(outputDirectoryPath, `${currentDirectoryNumber}`);

		if(!fs.existsSync(currentOutputDirectoryPath)) {
			fs.mkdirSync(currentOutputDirectoryPath);
		}

		//Default output for the whisper command is the <filename>.srt
		let subtitlesFilePath = `${currentOutputDirectoryPath}\\${mainVideos[i].replace(/\.[^/.]+$/, "")}.srt`

		if(!fs.existsSync(join(currentOutputDirectoryPath, `${mainVideos[i].replace(/\.[^/.]+$/, '')}.srt`))) {
			//Get the subtitles for a video
			let whisperCmd = `start whisper ${mainVideoPath} --max_line_width 25 --max_line_count 1 --word_timestamps True --model small --language English --output_format srt --output_dir ${currentOutputDirectoryPath}`;
			spawnSync(whisperCmd, [], {shell: true})
			console.log('Created Captions...');

			let contents = fs.readFileSync(subtitlesFilePath, 'utf-8');
			contents = contents.replaceAll(/.+finance/gi, 'BORSFINANCE');
			contents = contents.replaceAll(/\.\s/g, ' ');
			fs.writeFileSync(subtitlesFilePath, contents.toUpperCase(), 'utf-8');
		}

		//For each music font pairing
		for(let j = 0; j < VARIATION_COUNT; j++) {
			console.log('Creating video')

			if(j >= musicFiles.length) {
				shuffle(musicFiles);
			}

			if(j >= fontNames.length) {
				shuffle(fontNames)
			}

			let musicPath = join(musicDirectoryPath, musicFiles[j % musicFiles.length]);
			let fontName = fontNames[j % fontNames.length];
			let selectedColor = colors[Math.floor(Math.random() * colors.length)];

			let filename = getRandomFilename();
			let cmd = `start ffmpeg -i ${mainVideoPath} -i ${musicPath} -f lavfi -i "color=${selectedColor.hex}:s=32x32" -c:a aac -filter_complex "[2:v][0:v]scale2ref=iw:ih[color][main];[main][color]blend=shortest=1:all_mode=overlay:all_opacity=0.1[v]; [v]subtitles=${subtitlesFilePath.replaceAll(/\\/g, '\\\\\\\\').replaceAll(/:/g, '\\\\:')}:fontsdir=${fontFilesDirectoryPath.replaceAll(/\\/g, '\\\\\\\\').replaceAll(/:/g, '\\\\:')}:force_style='Alignment=2,MarginV=70,Fontname=${fontName},PrimaryColour=${selectedColor.ass}'[vout]; [0:a][1:a]amix=inputs=2:duration=shortest[aout];" -map "[vout]" -map "[aout]" ${join(currentOutputDirectoryPath, filename)}`
			spawnSync(cmd, [], {shell: true})
		}
	}

} catch (e) {
	// FontName may throw an Error
	console.log(e)
	process.exit();
}




