module Pages.DemoLanding exposing (Model, Msg, page)

import Dict exposing (Dict)
import Effect exposing (Effect)
import Element as E exposing (..)
import Element.Border as B
import Element.Events exposing (..)
import Element.Font as F
import Element.Input as I
import ExampleData
import Gen.Params.DemoLanding exposing (Params)
import Gen.Route exposing (Route)
import Html.Attributes
import Page
import Request
import Shared
import Simple.Transition as Transition
import Styling exposing (..)
import Types exposing (..)
import View exposing (View)


page : Shared.Model -> Request.With Params -> Page.With Model Msg
page _ req =
    Page.advanced
        { init = init
        , update = update req
        , view = view
        , subscriptions = subscriptions
        }



-- INIT


type alias Model =
    { selectedIndex : Int
    , hoverIndex : Maybe Int
    }


init : ( Model, Effect Msg )
init =
    ( { selectedIndex = 0, hoverIndex = Nothing }, Effect.none )



-- UPDATE


type Msg
    = OnSideIndexBarHover (Maybe Int)
    | OnSideBarItemClicked Int
    | GoToPage Route


update : Request.With Params -> Msg -> Model -> ( Model, Effect Msg )
update req msg model =
    case msg of
        OnSideIndexBarHover (Just i) ->
            ( { model | hoverIndex = Just i }, Effect.none )

        OnSideIndexBarHover Nothing ->
            ( { model | hoverIndex = Nothing }, Effect.none )

        OnSideBarItemClicked i ->
            ( { model | selectedIndex = i }, Effect.none )

        GoToPage route ->
            ( model, Effect.fromCmd (Request.pushRoute route req) )



-- SUBSCRIPTIONS


subscriptions : Model -> Sub Msg
subscriptions _ =
    Sub.none



-- VIEW


staticUseCases : Dict Int ( String, List ( Facet, Route ) )
staticUseCases =
    let
        p =
            ExampleData.facetPlaceholder
    in
    Dict.fromList <|
        [ ( 0
          , ( "Understand Code"
            , [ ( p "Code ownership by topic", Gen.Route.UseCaseCodeOwnershipTopical )
              , ( p "Code activity by team", Gen.Route.UseCaseCodeOwnershipAuthor )
              , ( p "API usage examples at Sourcegraph", Gen.Route.UseCaseCodeUsage )
              ]
            )
          )
        , ( 1
          , ( "Follow Developer Activity"
            , [ ( p "Recent commits by topic", Gen.Route.UseCaseRecentCommitsTopical )
              , ( p "Recent commits by teams", Gen.Route.UseCaseRecentCommitsAuthor )
              ]
            )
          )
        , ( 2
          , ( "Onboarding"
            , [ ( p "Styles at Sourcegraph", Gen.Route.UseCaseColorPalette ) ]
            )
          )
        , ( 4
          , ( "Refactor Code"
            , [ ( p "Find and replace anything", Gen.Route.UseCaseFindReplace ) ]
            )
          )
        ]


sideBarItem : Bool -> Bool -> Int -> String -> Element Msg
sideBarItem showSelected hover index label =
    let
        borderColor =
            if showSelected || hover then
                vividViolet

            else
                white
    in
    el
        [ padding 12
        , E.htmlAttribute <| Html.Attributes.style "cursor" "pointer"
        , onMouseEnter (OnSideIndexBarHover (Just index))
        , onMouseLeave (OnSideIndexBarHover Nothing)
        , onMouseDown (OnSideBarItemClicked index)
        , B.widthEach { left = 3, right = 0, top = 0, bottom = 0 }
        , B.color borderColor
        ]
        (text label)


sideMenu : Int -> Maybe Int -> Element Msg
sideMenu selectedIndex hoverIndex =
    column [ height fill ]
        (Dict.toList staticUseCases
            |> List.map
                (\( i, ( label, _ ) ) ->
                    sideBarItem
                        (i == selectedIndex && hoverIndex == Nothing)
                        (case hoverIndex of
                            Nothing ->
                                False

                            Just x ->
                                x == i
                        )
                        i
                        label
                )
        )


buttonAttrs : E.Color -> List (Attribute Msg)
buttonAttrs hoverColor =
    [ B.color gray
    , B.width 1
    , B.rounded 5
    , F.center
    , padding 5
    , width (px 600)
    , height (px 65)
    , mouseDown
        [ B.color skyBlue
        , B.shadow
            { offset = ( -2, -2 )
            , size = 0
            , blur = 0
            , color = skyBlue
            }
        ]
    , E.htmlAttribute <|
        Transition.properties
            [ Transition.borderColor 200 []
            , Transition.property "box-shadow" 200 [ Transition.easeOut ] -- naughty, not performant
            ]
    , mouseOver
        [ B.color hoverColor
        , B.shadow
            { offset = ( -3, -3 )
            , size = 1
            , blur = 0
            , color = hoverColor
            }
        ]
    ]


useCaseButton : Route -> String -> E.Element Msg
useCaseButton r text =
    el [ padding 15 ]
        (el
            []
            (I.button
                (buttonAttrs vividViolet)
                { onPress = Just (GoToPage r)
                , label = E.text text
                }
            )
        )


toButtons : Dict Int ( Facet, Route ) -> List (E.Element Msg)
toButtons facets =
    Dict.toList facets |> List.map (\( _, ( { title }, r ) ) -> useCaseButton r title)


tileRows : Dict Int ( Facet, Route ) -> List (E.Element Msg)
tileRows facets =
    let
        numPerRow =
            1
    in
    let
        tileRow tiles =
            row [] tiles
    in
    toButtons facets
        |> List.indexedMap Tuple.pair
        |> List.foldl
            (\( i, v ) ( acc, part ) ->
                if modBy numPerRow (i + 1) == 0 then
                    ( acc ++ [ part ++ [ v ] ], [] )

                else
                    ( acc, part ++ [ v ] )
            )
            ( [], [] )
        |> (\( acc, part ) -> List.map tileRow (acc ++ [ part ]))


body : Model -> Element Msg
body model =
    column [ width fill, height fill, padding 120, F.family [ F.typeface "Helvetica Neue" ] ]
        [ el [ width fill, padding 20, F.size 48 ] (text "Use Cases")
        , row [ width fill, height fill, padding 20, F.size 24 ]
            [ sideMenu model.selectedIndex model.hoverIndex
            , column [ width fill, height fill ]
                [ el [ centerX, F.size 24 ] <|
                    column [] <|
                        tileRows <|
                            Maybe.withDefault Dict.empty
                                (Dict.get
                                    (Maybe.withDefault model.selectedIndex model.hoverIndex)
                                    staticUseCases
                                    |> Maybe.map
                                        (\( _, facetsAndRoutes ) ->
                                            List.indexedMap Tuple.pair facetsAndRoutes
                                                |> Dict.fromList
                                        )
                                )
                ]
            ]
        ]


view : Model -> View Msg
view model =
    { title = "Compute | Use Cases"
    , element = body model
    }
