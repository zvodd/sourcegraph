module ViewData exposing (..)

import Chart as C
import Chart.Attributes as CA
import Dict exposing (Dict)
import Element as E exposing (..)
import Element.Background as Background
import Element.Border as B
import Element.Events
import Element.Font as F
import Element.Input as I
import Html.Attributes
import StopWords
import Styling exposing (..)
import Svg as S
import Svg.Attributes as SA
import Types exposing (..)


filterData : Filter a -> List DataValue -> List DataValue
filterData { dataPoints, sortByCount, reverse, excludeStopWords } data =
    let
        pipeSort =
            if sortByCount then
                List.sortWith
                    (\l r ->
                        if l.value < r.value then
                            GT

                        else if l.value > r.value then
                            LT

                        else
                            EQ
                    )

            else
                identity
    in
    let
        pipeReverse =
            if reverse then
                List.reverse

            else
                identity
    in
    let
        pipeStopWords =
            if excludeStopWords then
                List.filter (\{ name } -> not (Dict.member (String.toLower name) StopWords.words))

            else
                identity
    in
    data
        |> pipeStopWords
        |> pipeSort
        |> pipeReverse
        |> List.take dataPoints
        |> pipeReverse


histogramBarChart : List DataValue -> E.Element msg
histogramBarChart data =
    let
        ( fontSize, moveDown ) =
            case data of
                [] ->
                    ( 14, 15 )

                { value } :: _ ->
                    if value >= 10000 then
                        ( 11, 15 )

                    else if value >= 1000 then
                        ( 13, 15 )

                    else if value >= 100 then
                        ( 15, 18 )

                    else
                        ( 17, 18 )
    in
    E.el
        [ E.width E.fill
        , E.height E.fill
        , E.centerX
        , E.alignTop
        , E.padding 100
        ]
        (E.html <|
            C.chart
                [ CA.height 300, CA.width 1300 ]
                [ C.bars
                    [ CA.spacing 0.0 ]
                    [ C.bar .value [ CA.color "#A112FF", CA.roundTop 0.2 ] ]
                    data
                , C.binLabels .name [ CA.moveDown 15, CA.rotate 45, CA.alignRight ]
                , C.barLabels [ CA.moveDown moveDown, CA.color "white", CA.fontSize fontSize ]
                , C.eachBar <|
                    \_ _ ->
                        [ C.svg <|
                            \_ ->
                                S.svg []
                                    [ S.a
                                        [ SA.xlinkHref "https://sourcegraph.com" ]
                                        [ S.g [ SA.fill "transparent" ]
                                            -- TODO stretch this to the bar
                                            [ S.rect [ SA.width "100", SA.height "100" ] []
                                            , S.text_ [ SA.y "50", SA.fill "none" ] [ S.text "qux" ]
                                            ]
                                        ]
                                    ]
                        ]
                ]
        )


histogramColorPalette : List DataValue -> E.Element msg
histogramColorPalette data =
    E.el
        [ E.width (E.fill |> E.maximum 800 |> E.minimum 800)
        , E.height E.fill
        , E.centerX
        , E.alignTop
        , E.padding 30
        ]
        (E.html <|
            let
                colorTile index value =
                    let
                        size =
                            -- 100 px each tile
                            150

                        y =
                            toFloat (index // 5) * size

                        x =
                            toFloat (remainderBy 5 index) * size

                        f =
                            String.fromFloat

                        color =
                            "#" ++ value.name
                    in
                    S.g
                        [ SA.width (f (5 * size)) ]
                        [ S.rect
                            [ SA.width (f size)
                            , SA.height (f size)
                            , SA.fill color
                            , SA.x <| f x
                            , SA.y <| f y
                            ]
                            []
                        , S.text_
                            [ SA.x (f (x + 5))
                            , SA.y (f (y + 30))
                            , SA.fontSize "16"
                            , SA.fill color
                            , SA.filter "invert(100%)"
                            ]
                            [ S.text value.name
                            ]
                        , S.text_
                            [ SA.x (f (x + 5))
                            , SA.y (f (y + 60))
                            , SA.fontSize "16"
                            , SA.fill color
                            , SA.filter "invert(100%)"
                            ]
                            [ S.text ("(" ++ String.fromFloat value.value ++ ")")
                            ]
                        ]
            in
            S.svg [ SA.width "800", SA.height "800" ] <| List.indexedMap colorTile data
        )


table : List DataValue -> E.Element msg
table data =
    let
        headerAttrs =
            [ F.bold, F.size 18, E.padding 5, B.widthEach { bottom = 1, top = 0, left = 0, right = 0 } ]
    in
    E.el [ E.padding 100, E.centerX ] <|
        if List.length data > 0 then
            E.table [ E.width (E.fill |> E.minimum 600) ]
                { data = data
                , columns =
                    [ { header = E.el headerAttrs <| E.text " "
                      , width = E.fillPortion 2
                      , view =
                            \v ->
                                E.el [ E.padding 5 ]
                                    (E.el
                                        [ E.width E.fill
                                        , E.padding 10
                                        , B.rounded 5
                                        , B.width 1
                                        ]
                                        (E.text v.name)
                                    )
                      }
                    , { header = E.el (headerAttrs ++ [ F.alignRight ]) <| E.text "Count"
                      , width = E.fillPortion 1
                      , view =
                            \v ->
                                E.el [ E.centerY, F.size 25, F.alignRight, E.padding 5 ]
                                    (E.text <| String.fromFloat <| v.value)
                      }
                    ]
                }

        else
            E.none


plainData : List DataValue -> E.Element msg
plainData data =
    E.row []
        [ E.el [ E.padding 10, E.alignLeft, E.width (E.fill |> E.maximum 800 |> E.minimum 800) ]
            (E.column [] (List.map (\d -> E.text d.name) data))
        ]


patchData : List DataValue -> E.Element msg
patchData data =
    E.row []
        [ E.el [ E.padding 10, E.alignLeft, E.width E.fill ]
            (E.column
                [ E.width E.fill ]
                (List.map
                    (\d ->
                        E.row [ E.width E.fill, B.widthEach { top = 1, bottom = 0, left = 0, right = 0 }, B.color vermillion ]
                            [ E.textColumn [ E.width (E.fill |> E.maximum 1065), paddingXY 0 20 ] [ text d.name ]
                            , I.button
                                [ B.color vermillion
                                , B.roundEach { topLeft = 0, topRight = 0, bottomLeft = 5, bottomRight = 5 }
                                , B.widthEach { bottom = 1, top = 0, left = 1, right = 1 }
                                , mouseOver [ Background.color vermillion, F.color white ]
                                , alignTop
                                , alignRight
                                , padding 20
                                ]
                                { onPress = Nothing
                                , label =
                                    el
                                        [ centerX
                                        , centerY
                                        , F.family [ F.typeface "Helvetica Neue" ]
                                        , F.size 24
                                        ]
                                        (E.text "Add to Batch Change ↗")
                                }
                            ]
                    )
                    data
                )
            )
        ]


csvData : List DataValue -> E.Element msg
csvData data =
    E.row []
        [ E.el [ E.padding 10, E.alignLeft, E.width (E.fill |> E.maximum 800 |> E.minimum 800) ]
            (E.column [] (List.map (\d -> E.text d.name) data))
        ]


tabLabel : VisualKind -> String
tabLabel thisTab =
    case thisTab of
        BarChart ->
            "Chart"

        ColorPalette ->
            "Color Palette"

        Table ->
            "Table"

        PlainData ->
            "Plain data"

        Patch ->
            "Patch"

        ModifiedContent ->
            "Modified Content"

        CSV ->
            "CSV"

        _ ->
            "Not implemented: " ++ Debug.toString thisTab


tab : (VisualKind -> msg) -> VisualKind -> VisualKind -> E.Element msg
tab onClick selectedTab thisTab =
    let
        isSelected =
            thisTab == selectedTab

        padOffset =
            if isSelected then
                0

            else
                2

        borderWidths =
            if isSelected then
                { left = 2, top = 2, right = 2, bottom = 0 }

            else
                { bottom = 2, top = 0, left = 0, right = 0 }

        corners =
            if isSelected then
                { topLeft = 6, topRight = 6, bottomLeft = 0, bottomRight = 0 }

            else
                { topLeft = 0, topRight = 0, bottomLeft = 0, bottomRight = 0 }

        tabColor =
            case selectedTab of
                BarChart ->
                    vividViolet

                Table ->
                    vermillion

                PlainData ->
                    skyBlue

                Patch ->
                    vermillion

                ModifiedContent ->
                    skyBlue

                _ ->
                    gray
    in
    E.el
        [ B.widthEach borderWidths
        , B.roundEach corners
        , B.color tabColor
        , Element.Events.onClick <| onClick thisTab
        , E.htmlAttribute <| Html.Attributes.style "cursor" "pointer"
        , E.width E.fill
        ]
        (E.el
            [ E.centerX
            , E.centerY
            , E.paddingEach { left = 30, right = 30, top = 10 + padOffset, bottom = 10 - padOffset }
            ]
            (E.text <| tabLabel thisTab)
        )


toDataList : VisualKind -> Dict String DataValue -> List DataValue
toDataList kind resultsMap =
    case kind of
        BarChart ->
            Dict.toList resultsMap
                |> List.map Tuple.second

        ColorPalette ->
            Dict.toList resultsMap
                |> List.map Tuple.second

        Table ->
            Dict.toList resultsMap
                |> List.map Tuple.second

        PlainData ->
            Dict.values resultsMap

        Patch ->
            Dict.values resultsMap

        ModifiedContent ->
            Dict.values resultsMap

        CSV ->
            Dict.toList resultsMap
                |> List.map Tuple.second

        _ ->
            []


toVisual : VisualKind -> List DataValue -> E.Element msg
toVisual kind =
    case kind of
        BarChart ->
            histogramBarChart

        ColorPalette ->
            histogramColorPalette

        Table ->
            table

        PlainData ->
            plainData

        Patch ->
            patchData

        ModifiedContent ->
            plainData

        CSV ->
            csvData

        _ ->
            histogramBarChart


view : VisualKind -> Filter a -> Dict String DataValue -> E.Element msg
view kind filter dataMap =
    dataMap
        |> toDataList kind
        |> filterData filter
        |> toVisual kind


tabbedView : List VisualKind -> (VisualKind -> msg) -> VisualKind -> Filter a -> Dict String DataValue -> E.Element msg
tabbedView tabs onClick selectedTab filter dataMap =
    E.column [ E.width E.fill ]
        [ if List.length tabs == 1 then
            E.none

          else
            E.row [ E.centerX, E.width E.fill ] (List.map (tab onClick selectedTab) tabs)
        , view selectedTab filter dataMap
        ]



-- Helpers


parseResults : List Types.Result -> List String
parseResults l =
    List.filterMap
        (\r ->
            case r of
                Output v ->
                    String.split "\n" v.value
                        |> List.filter (not << String.isEmpty)
                        |> Just

                ReplaceInPlace v ->
                    Just [ v.value ]
        )
        l
        |> List.concat


newDataValue : String -> DataValue
newDataValue textResult =
    case String.split "@@@" textResult of
        -- XXX magic string
        [] ->
            { name = textResult, value = 1, update = (+) }

        [ _ ] ->
            { name = textResult, value = 1, update = (+) }

        name :: floatValue :: [] ->
            case String.toFloat floatValue of
                Just value ->
                    { name = name, value = value, update = \_ _ -> value }

                Nothing ->
                    -- Never
                    { name = textResult, value = 1, update = (+) }

        _ ->
            -- Never
            { name = textResult, value = 1, update = (+) }
