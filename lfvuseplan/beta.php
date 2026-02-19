<?php
require __DIR__ . '/vendor/autoload.php';
require __DIR__ . '/simple_html_dom.php';
$lfvBaseUrl = 'https://aro.lfv.se';
$lfvDailyUseUrl = '/Editorial/View/GeneralDocument?torLinkId=337&type=AIS&folderId=77';

$html = file_get_html($lfvBaseUrl.$lfvDailyUseUrl);

$aLinks = $html->find('a.document-link');

$a = end($aLinks);

$finalPdfUrl = $lfvBaseUrl.$a->href;


// Parse PDF file and build necessary objects.
$parser = new \Smalot\PdfParser\Parser();
$pdf = $parser->parseContent(file_get_contents($finalPdfUrl));
$text = $pdf->getText();
$allRests = [];
foreach(preg_split("/((\r?\n)|(\r\n?))/", $text) as $line){
	try{
		if(!str_contains($line,"ES") && !str_contains($line,"ES SUP")){
			continue;
		}
		if(str_contains($line,"ES SUP ") && str_contains($line,"FL")){
			$line = str_replace("ES SUP ","ES SUP",$line);
		}
		
		$comment = "";
		if(str_starts_with($line,"CIV ACFT") || str_starts_with($line,"MIL ACFT")){
			$comment = "FLYG";
			$line = trim(substr($line,8));
		}else if(str_starts_with($line,"TT")){
			$comment = "FLYG";
			$line = trim(substr($line,2));
		}

		$line = preg_replace_callback('/\t/', function($matches) {
			return str_repeat(' ', 1);
		}, $line);
		$orginal = $line;
		$arr = explode(" ",$line);
		if(str_contains($line,"ES SUP")){
			if(str_contains($arr[1],":")){
				if(str_contains($line,"ft")){
					$arr[0] = $arr[1];
					$arr[1] = $arr[2];
					$arr[2] = $arr[5];
					$arr[3] = $arr[10];
					$arr[4] = $arr[8];
					$arr[5] = $arr[9];
					$arr[6] = $arr[11];
				}else{
					$arr[0] = $arr[1];
					$arr[1] = $arr[2];
					$arr[2] = $arr[9];
					$arr[3] = $arr[11];
					$arr[4] = $arr[6];
					$arr[6] = $arr[8];
				}
			}else{
				if(str_contains($line,"ft")){
					$arr[0] = $arr[1];
					$arr[1] = $arr[2];
					$arr[2] = $arr[3];
					$arr[3] = $arr[4];
					$arr[4] = $arr[7];
					$arr[5] = $arr[12];
					$arr[7] = $arr[10];
					$arr[8] = $arr[11];
					unset($arr[11]);
				}else{
					$arr[0] = $arr[1];
					$arr[1] = $arr[2];
					$arr[2] = $arr[6];
					$arr[3] = $arr[4];
					$arr[4] = $arr[6];
					$arr[6] = $arr[8];
				}
			}
		}
		
		$arr = array_values($arr);
		if(count($arr) > 15){
			
			continue;
		}
		$rest = new Restriction();
		// NAME
		$es = array_search("ES",$arr);
		if(str_contains($arr[$es+1], "/")){
			$rest->name = $arr[$es].$arr[$es+2];
		}else{
			$rest->name = $arr[$es].$arr[$es+1];
		}

		// ALTITUDE
		$ftSearch = array_search("ft", $arr);
		if($ftSearch){
			$rest->altitudeType = "ft";
			$rest->altitude = $arr[$ftSearch-1];
		}else{
			$flSearch = array_search("FL", $arr);
			$rest->altitudeType = "FL";
			$rest->altitude = $arr[$flSearch+2];
		}

		// TO TIME
		if(strlen($arr[0]) > 2 && $arr[0][2] == ':'){
			$rest->to = new DateTime('now');
			$rest->to->setTime(substr($arr[0],0,2),substr($arr[0],3,2));
			unset($arr[0]);
		}else{
			$rest->to = new DateTime("this year ".getFullMonth($arr[1]).' '.$arr[0]);
			$rest->to->setTime(23,59,59);
			unset($arr[0]);
			unset($arr[1]);
		}
		$arr = array_values($arr);

		// FROM TIME
		if(strlen($arr[0]) > 2 && $arr[0][2] == ':'){
			$rest->from = new DateTime('now');
			$rest->from->setTime(substr($arr[0],0,2),substr($arr[0],3,2));
		}else{
			$rest->from = new DateTime("this year ".getFullMonth($arr[1]).' '.$arr[0]);
		}
		
		// COMMENT
		$rest->comment = $comment;

		array_push($allRests,$rest);
	}
	catch (Exception $e){}
}
$outputText = "";
foreach ($allRests as $rest){
    $outputText .= $rest->name.':';
    $outputText .= $rest->from->format('ymd').':';
    $outputText .= $rest->to->format('ymd').':';
    $outputText .= '0'.':';
    $outputText .= $rest->from->format('Hi').':';
    $outputText .= $rest->to->format('Hi').':';
    $outputText .= '0'.':';
    if($rest->altitudeType == 'FL'){
        $outputText .= $rest->altitude.'00:';
    }else{
        $outputText .= $rest->altitude.':';
    }
	$outputText .= $rest->comment;
    //$outputText .= "\n";
	//$outputText .= $rest->name.':MANUAL';
	$outputText .= "\n";
}
$outputText = trim($outputText);

echo $outputText;
/*// Set the content type and headers to force a download
header('Content-Type: text/plain');
header('Content-Disposition: attachment; filename="TopSkyAreasManualAct.txt"');

// Create and write the text to a file
$file = fopen('/var/tmp/TopSkyAreasManualAct.txt', 'w');
fwrite($file, $outputText);
fclose($file);

// Read and output the file content
readfile('/var/tmp/TopSkyAreasManualAct.txt');

// Optionally, you can delete the file after it has been served
unlink('/var/tmp/TopSkyAreasManualAct.txt');*/


class Restriction {
    public $name;
    public $from;
    public $to;
    public $altitude;
    public $altitudeType;
	public $comment;
}

function getFullMonth($shortMonth){
    $monthMapping = array(
        "jan" => "January",
        "feb" => "February",
        "mar" => "March",
        "apr" => "April",
        "maj" => "May",
        "jun" => "June",
        "jul" => "July",
        "aug" => "August",
        "sep" => "September",
        "okt" => "October",
        "nov" => "November",
        "dec" => "December"
    );

    return $monthMapping[$shortMonth];
}